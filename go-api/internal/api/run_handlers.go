package api

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

type createRunRequest struct {
	DeploymentID      string         `json:"deployment_id"`
	WorkflowVersionID string         `json:"workflow_version_id"`
	MachineID         string         `json:"machine_id"`
	Inputs            map[string]any `json:"inputs"`
	RunOrigin         string         `json:"run_origin"`
	Comment           string         `json:"comment"`
}

func (s *Server) createRun(w http.ResponseWriter, r *http.Request) {
	var req createRunRequest
	if err := readJSONLoose(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	var dep deployment
	var err error
	origin := normalizeRunOrigin(req.RunOrigin, "api")
	if strings.TrimSpace(req.DeploymentID) != "" {
		dep, err = s.fetchDeployment(r, req.DeploymentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: "Deployment not found"})
			return
		}
		if err := s.authorizeDeployment(r, dep); err != nil {
			writeJSON(w, http.StatusNotFound, apiError{Error: "Workflow not found"})
			return
		}
	} else {
		if strings.TrimSpace(req.WorkflowVersionID) == "" || strings.TrimSpace(req.MachineID) == "" {
			writeJSON(w, http.StatusBadRequest, apiError{Error: "workflow_version_id and machine_id are required"})
			return
		}
		dep, err = s.fetchRunTarget(r, req.WorkflowVersionID, req.MachineID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, apiError{Error: "Workflow version or machine not found"})
			return
		}
		origin = normalizeRunOrigin(req.RunOrigin, "manual")
	}
	workflowAPI := applyExternalInputs(dep.Version.WorkflowAPI, req.Inputs)
	if dep.Machine.Type == "classic" && !isFullWorkflowGraph(dep.Version.Workflow) {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "This workflow version does not contain a full ComfyUI graph. Open it in ComfyUI and deploy a new version before running it on a Classic Machine."})
		return
	}
	runID := uuid.NewString()
	inputsRaw, _ := json.Marshal(req.Inputs)
	_, err = s.store.DB.ExecContext(r.Context(), `
		INSERT INTO comfyui_deploy.workflow_runs
			(id, workflow_id, workflow_version_id, workflow_inputs, machine_id, origin)
		VALUES ($1, $2, $3, $4, $5, $6::workflow_run_origin)
	`, runID, dep.WorkflowID, dep.WorkflowVersionID, inputsRaw, dep.MachineID, origin)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	if err := s.dispatchRun(r, dep, runID, workflowAPI); err != nil {
		_, _ = s.store.DB.ExecContext(r.Context(), `UPDATE comfyui_deploy.workflow_runs SET status = 'failed' WHERE id = $1`, runID)
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	_, _ = s.store.DB.ExecContext(r.Context(), `UPDATE comfyui_deploy.workflow_runs SET started_at = now() WHERE id = $1`, runID)
	writeJSON(w, http.StatusOK, map[string]string{"run_id": runID})
}

func (s *Server) updateRun(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RunID      string          `json:"run_id"`
		Status     string          `json:"status"`
		OutputData json.RawMessage `json:"output_data"`
		Comment    string          `json:"comment"`
	}
	if err := readJSONLoose(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	if req.OutputData != nil {
		_, err := s.store.DB.ExecContext(r.Context(), `
			INSERT INTO comfyui_deploy.workflow_run_outputs (run_id, data)
			VALUES ($1, $2)
		`, req.RunID, req.OutputData)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
	}
	if req.Status != "" {
		_, err := s.store.DB.ExecContext(r.Context(), `
			UPDATE comfyui_deploy.workflow_runs
			SET status = $1, ended_at = CASE WHEN $1 IN ('success','failed') THEN now() ELSE NULL END
			WHERE id = $2
		`, req.Status, req.RunID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "success"})
}

func normalizeRunOrigin(value string, fallback string) string {
	switch strings.TrimSpace(value) {
	case "manual", "api", "public-share":
		return strings.TrimSpace(value)
	default:
		return fallback
	}
}

func (s *Server) dispatchRun(r *http.Request, dep deployment, runID string, workflowAPI json.RawMessage) error {
	origin := requestOrigin(r)
	payload := map[string]any{
		"workflow_api_raw":     json.RawMessage(workflowAPI),
		"workflow":             dep.Version.Workflow,
		"status_endpoint":      origin + "/api/update-run",
		"file_upload_endpoint": origin + "/api/file-upload",
		"prompt_id":            runID,
	}
	switch dep.Machine.Type {
	case "classic":
		endpoint, headers := machineEndpointAndHeaders(dep.Machine)
		return postJSON(r, endpoint+"/comfyui-deploy/run", headers, payload)
	case "runpod-serverless":
		return postJSON(r, strings.TrimRight(dep.Machine.Endpoint, "/")+"/run", bearerHeaders(dep.Machine.AuthToken), map[string]any{"input": payload})
	case "modal-serverless", "comfy-deploy-serverless":
		return postJSON(r, strings.TrimRight(dep.Machine.Endpoint, "/")+"/run", map[string]string{"Content-Type": "application/json"}, map[string]any{"input": payload})
	default:
		return errors.New("unsupported machine type")
	}
}

func postJSON(r *http.Request, endpoint string, headers map[string]string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	client := http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New("machine returned " + resp.Status)
	}
	return nil
}

func machineEndpointAndHeaders(m machine) (string, map[string]string) {
	endpoint := strings.TrimRight(m.Endpoint, "/")
	token := ""
	if m.AuthToken != nil {
		token = strings.TrimSpace(*m.AuthToken)
	}
	if parsed, err := url.Parse(endpoint); err == nil && parsed.User != nil {
		password, _ := parsed.User.Password()
		token = parsed.User.Username() + ":" + password
		parsed.User = nil
		endpoint = strings.TrimRight(parsed.String(), "/")
	}
	return endpoint, bearerHeaders(&token)
}

func bearerHeaders(token *string) map[string]string {
	headers := map[string]string{"Content-Type": "application/json"}
	if token == nil || strings.TrimSpace(*token) == "" {
		return headers
	}
	value := strings.TrimSpace(*token)
	if strings.HasPrefix(strings.ToLower(value), "basic ") || strings.HasPrefix(strings.ToLower(value), "bearer ") {
		headers["Authorization"] = value
	} else if strings.Contains(value, ":") {
		headers["Authorization"] = "Basic " + base64.StdEncoding.EncodeToString([]byte(value))
	} else {
		headers["Authorization"] = "Bearer " + value
	}
	return headers
}

func requestOrigin(r *http.Request) string {
	proto := r.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
	}
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	return proto + "://" + host
}

func (s *Server) authorizeDeployment(r *http.Request, dep deployment) error {
	user := currentUser(r)
	if user.OrgID != "" {
		if dep.OrgID == nil || *dep.OrgID != user.OrgID {
			return errors.New("workflow not found")
		}
		return nil
	}
	if dep.OrgID == nil && dep.UserID == user.UserID {
		return nil
	}
	return errors.New("workflow not found")
}

func nullRaw(value json.RawMessage) json.RawMessage {
	if len(value) == 0 {
		return json.RawMessage("null")
	}
	return value
}

var _ = sql.ErrNoRows
