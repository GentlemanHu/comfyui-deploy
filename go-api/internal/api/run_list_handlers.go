package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type runRecord struct {
	ID                string            `json:"id"`
	WorkflowID        string            `json:"workflow_id"`
	WorkflowVersionID *string           `json:"workflow_version_id"`
	MachineID         *string           `json:"machine_id"`
	Origin            string            `json:"origin"`
	Status            string            `json:"status"`
	WorkflowInputs    json.RawMessage   `json:"workflow_inputs"`
	CreatedAt         time.Time         `json:"created_at"`
	StartedAt         *time.Time        `json:"started_at"`
	EndedAt           *time.Time        `json:"ended_at"`
	Progress          *float64          `json:"progress,omitempty"`
	CurrentNode       *string           `json:"current_node,omitempty"`
	LiveStatus        json.RawMessage   `json:"live_status,omitempty"`
	MachineName       *string           `json:"machine_name,omitempty"`
	Version           *int              `json:"version,omitempty"`
	Outputs           []runOutputRecord `json:"outputs,omitempty"`
}

type runOutputRecord struct {
	ID        string          `json:"id"`
	RunID     string          `json:"run_id"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func (s *Server) listRuns(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "workflow not found"})
		return
	}
	_ = s.finalizeStaleRunsForWorkflow(r, workflowID)
	limit := clampInt(queryInt(r, "limit", 50), 1, 200)
	offset := maxInt(queryInt(r, "offset", 0), 0)
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       wr.progress, wr.current_node, COALESCE(wr.live_status, 'null'::jsonb),
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.workflow_id = $1
		ORDER BY wr.created_at DESC
		LIMIT $2 OFFSET $3
	`, workflowID, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()
	items := make([]runRecord, 0)
	for rows.Next() {
		item, err := scanRun(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) getRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	s.writeRun(w, r, runID, false)
}

func (s *Server) getRunQuery(w http.ResponseWriter, r *http.Request) {
	runID := r.URL.Query().Get("run_id")
	if runID == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "run_id is required"})
		return
	}
	s.writeRun(w, r, runID, true)
}

func (s *Server) writeRun(w http.ResponseWriter, r *http.Request, runID string, includeOutputs bool) {
	_ = s.finalizeStaleRun(r, runID)
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       wr.progress, wr.current_node, COALESCE(wr.live_status, 'null'::jsonb),
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.id = $1
	`, runID)
	item, err := scanRun(row)
	if notFoundOrInternal(w, err, "run not found") {
		return
	}
	if err := s.ensureWorkflowOwner(r, item.WorkflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	if includeOutputs {
		outputs, err := s.fetchRunOutputs(r, item.ID, true)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		item.Outputs = outputs
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) getShareRun(w http.ResponseWriter, r *http.Request) {
	shareID := chi.URLParam(r, "share_id")
	if !s.shareAccessAllowedByID(r, shareID) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "share access key required", "access_required": true})
		return
	}
	runID := chi.URLParam(r, "run_id")
	if !s.runBelongsToShare(r, shareID, runID) {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	_ = s.finalizeStaleRun(r, runID)
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       wr.progress, wr.current_node, COALESCE(wr.live_status, 'null'::jsonb),
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.id = $1
	`, runID)
	item, err := scanRun(row)
	if notFoundOrInternal(w, err, "run not found") {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) getShareRunOutputs(w http.ResponseWriter, r *http.Request) {
	shareID := chi.URLParam(r, "share_id")
	if !s.shareAccessAllowedByID(r, shareID) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "share access key required", "access_required": true})
		return
	}
	runID := chi.URLParam(r, "run_id")
	if !s.runBelongsToShare(r, shareID, runID) {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	items, err := s.fetchRunOutputs(r, runID, false)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) getRunOutputs(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	run, err := s.fetchRunForOwner(r, runID)
	if notFoundOrInternal(w, err, "run not found") {
		return
	}
	if err := s.ensureWorkflowOwner(r, run.WorkflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	items, err := s.fetchRunOutputs(r, runID, false)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) fetchRunOutputs(r *http.Request, runID string, withPublicURLs bool) ([]runOutputRecord, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT id, run_id, COALESCE(data, 'null'::jsonb), created_at, updated_at
		FROM comfyui_deploy.workflow_run_outputs
		WHERE run_id = $1
		ORDER BY created_at ASC
	`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]runOutputRecord, 0)
	for rows.Next() {
		var item runOutputRecord
		if err := rows.Scan(&item.ID, &item.RunID, &item.Data, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		if withPublicURLs {
			item.Data = s.addPublicOutputURLs(item.Data, runID)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) fetchRunForOwner(r *http.Request, runID string) (runRecord, error) {
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       wr.progress, wr.current_node, COALESCE(wr.live_status, 'null'::jsonb),
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.id = $1
	`, runID)
	return scanRun(row)
}

func (s *Server) finalizeStaleRunsForWorkflow(r *http.Request, workflowID string) error {
	_, err := s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.workflow_runs wr
		SET status = 'success',
		    ended_at = COALESCE(ended_at, latest_output.latest_at)
		FROM (
			SELECT run_id, MAX(updated_at) AS latest_at
			FROM comfyui_deploy.workflow_run_outputs
			GROUP BY run_id
		) latest_output
		WHERE wr.id = latest_output.run_id
		  AND wr.workflow_id = $1
		  AND wr.status IN ('not-started','running','uploading')
		  AND latest_output.latest_at < now() - interval '60 seconds'
		  AND wr.created_at < now() - interval '60 seconds'
	`, workflowID)
	return err
}

func (s *Server) finalizeStaleRun(r *http.Request, runID string) error {
	_, err := s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.workflow_runs wr
		SET status = 'success',
		    ended_at = COALESCE(ended_at, latest_output.latest_at)
		FROM (
			SELECT run_id, MAX(updated_at) AS latest_at
			FROM comfyui_deploy.workflow_run_outputs
			WHERE run_id = $1
			GROUP BY run_id
		) latest_output
		WHERE wr.id = latest_output.run_id
		  AND wr.id = $1
		  AND wr.status IN ('not-started','running','uploading')
		  AND latest_output.latest_at < now() - interval '60 seconds'
		  AND wr.created_at < now() - interval '60 seconds'
	`, runID)
	return err
}

func (s *Server) runBelongsToShare(r *http.Request, shareID string, runID string) bool {
	var exists bool
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM comfyui_deploy.workflow_runs wr
			JOIN comfyui_deploy.deployments d ON d.workflow_id = wr.workflow_id
			WHERE wr.id = $2
			  AND wr.origin = 'public-share'
			  AND d.environment = 'public-share'
			  AND (d.id::text = $1 OR d.share_slug = $1)
		)
	`, shareID, runID).Scan(&exists)
	return err == nil && exists
}

func scanRun(row rowScanner) (runRecord, error) {
	var item runRecord
	var workflowVersionID sql.NullString
	var machineID sql.NullString
	var startedAt sql.NullTime
	var endedAt sql.NullTime
	var progress sql.NullFloat64
	var currentNode sql.NullString
	var machineName sql.NullString
	var version sql.NullInt64
	err := row.Scan(
		&item.ID, &item.WorkflowID, &workflowVersionID, &machineID, &item.Origin, &item.Status,
		&item.WorkflowInputs, &item.CreatedAt, &startedAt, &endedAt, &progress, &currentNode, &item.LiveStatus, &machineName, &version,
	)
	item.WorkflowVersionID = ptrNullString(workflowVersionID)
	item.MachineID = ptrNullString(machineID)
	if startedAt.Valid {
		item.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		item.EndedAt = &endedAt.Time
	}
	if progress.Valid {
		value := progress.Float64
		item.Progress = &value
	}
	item.CurrentNode = ptrNullString(currentNode)
	item.MachineName = ptrNullString(machineName)
	if version.Valid {
		v := int(version.Int64)
		item.Version = &v
	}
	return item, err
}

func (s *Server) addPublicOutputURLs(data json.RawMessage, runID string) json.RawMessage {
	var root any
	if err := json.Unmarshal(data, &root); err != nil {
		return data
	}
	object, ok := root.(map[string]any)
	if !ok {
		return data
	}
	for _, key := range []string{"images", "files", "gifs"} {
		addPublicURLsToOutputItems(object[key], runID, s.storage.PublicURL)
	}
	updated, err := json.Marshal(object)
	if err != nil {
		return data
	}
	return updated
}

func addPublicURLsToOutputItems(value any, runID string, publicURL func(string) string) {
	items, ok := value.([]any)
	if !ok {
		return
	}
	for _, item := range items {
		object, ok := item.(map[string]any)
		if !ok {
			continue
		}
		filename, ok := object["filename"].(string)
		if !ok || filename == "" {
			continue
		}
		object["url"] = publicURL("outputs/runs/" + runID + "/" + filename)
	}
}
