package api

import (
	"encoding/json"
	"net/http"
)

func (s *Server) fetchDeployment(r *http.Request, deploymentID string) (deployment, error) {
	var dep deployment
	var orgID, machineOrgID, machineAuthToken nullableString
	var workflow, workflowAPI, snapshot []byte
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT
			d.id, d.user_id, d.org_id, d.workflow_version_id, d.workflow_id, d.machine_id,
			wv.workflow_id, wv.id, wv.workflow, wv.workflow_api, wv.snapshot, wv.version, wv.created_at, wv.updated_at,
			m.id, m.user_id, m.org_id, m.name, m.endpoint, m.auth_token, m.type, m.disabled
		FROM comfyui_deploy.deployments d
		JOIN comfyui_deploy.workflow_versions wv ON wv.id = d.workflow_version_id
		JOIN comfyui_deploy.machines m ON m.id = d.machine_id
		WHERE d.id = $1
	`, deploymentID).Scan(
		&dep.ID, &dep.UserID, &orgID, &dep.WorkflowVersionID, &dep.WorkflowID, &dep.MachineID,
		&dep.Version.WorkflowID, &dep.Version.ID, &workflow, &workflowAPI, &snapshot, &dep.Version.Version, &dep.Version.CreatedAt, &dep.Version.UpdatedAt,
		&dep.Machine.ID, &dep.Machine.UserID, &machineOrgID, &dep.Machine.Name, &dep.Machine.Endpoint, &machineAuthToken, &dep.Machine.Type, &dep.Machine.Disabled,
	)
	if err != nil {
		return dep, err
	}
	dep.OrgID = orgID.ptr()
	dep.Version.Workflow = scanRawMessage(workflow)
	dep.Version.WorkflowAPI = scanRawMessage(workflowAPI)
	dep.Version.Snapshot = scanRawMessage(snapshot)
	dep.Machine.OrgID = machineOrgID.ptr()
	dep.Machine.AuthToken = machineAuthToken.ptr()
	return dep, nil
}

func (s *Server) fetchRunTarget(r *http.Request, workflowVersionID string, machineID string) (deployment, error) {
	user := currentUser(r)
	var dep deployment
	var orgID, machineOrgID, machineAuthToken nullableString
	var workflow, workflowAPI, snapshot []byte
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT
			w.user_id, w.org_id, wv.workflow_id, wv.id,
			wv.workflow, wv.workflow_api, wv.snapshot, wv.version, wv.created_at, wv.updated_at,
			m.id, m.user_id, m.org_id, m.name, m.endpoint, m.auth_token, m.type, m.disabled
		FROM comfyui_deploy.workflow_versions wv
		JOIN comfyui_deploy.workflows w ON w.id = wv.workflow_id
		JOIN comfyui_deploy.machines m ON m.id = $2
		WHERE wv.id = $1
		  AND m.disabled = false
		  AND (
			($3::text <> '' AND w.org_id = $3 AND m.org_id = $3)
			OR
			($3::text = '' AND w.org_id IS NULL AND m.org_id IS NULL AND w.user_id = $4 AND m.user_id = $4)
		  )
	`, workflowVersionID, machineID, user.OrgID, user.UserID).Scan(
		&dep.UserID, &orgID, &dep.WorkflowID, &dep.WorkflowVersionID,
		&workflow, &workflowAPI, &snapshot, &dep.Version.Version, &dep.Version.CreatedAt, &dep.Version.UpdatedAt,
		&dep.Machine.ID, &dep.Machine.UserID, &machineOrgID, &dep.Machine.Name, &dep.Machine.Endpoint, &machineAuthToken, &dep.Machine.Type, &dep.Machine.Disabled,
	)
	if err != nil {
		return dep, err
	}
	dep.OrgID = orgID.ptr()
	dep.MachineID = dep.Machine.ID
	dep.Version.WorkflowID = dep.WorkflowID
	dep.Version.ID = dep.WorkflowVersionID
	dep.Version.Workflow = scanRawMessage(workflow)
	dep.Version.WorkflowAPI = scanRawMessage(workflowAPI)
	dep.Version.Snapshot = scanRawMessage(snapshot)
	dep.Machine.OrgID = machineOrgID.ptr()
	dep.Machine.AuthToken = machineAuthToken.ptr()
	return dep, nil
}

type nullableString struct {
	String string
	Valid  bool
}

func (n *nullableString) Scan(value any) error {
	if value == nil {
		n.Valid = false
		n.String = ""
		return nil
	}
	n.Valid = true
	switch typed := value.(type) {
	case string:
		n.String = typed
	case []byte:
		n.String = string(typed)
	}
	return nil
}

func (n nullableString) ptr() *string {
	if !n.Valid {
		return nil
	}
	return &n.String
}

func applyExternalInputs(workflowAPI json.RawMessage, inputs map[string]any) json.RawMessage {
	if len(inputs) == 0 {
		return workflowAPI
	}
	var graph map[string]map[string]any
	if err := json.Unmarshal(workflowAPI, &graph); err != nil {
		return workflowAPI
	}
	for key, node := range graph {
		rawInputs, ok := node["inputs"].(map[string]any)
		if !ok {
			continue
		}
		inputID, ok := rawInputs["input_id"].(string)
		if !ok || inputID == "" {
			continue
		}
		newValue, ok := inputs[inputID]
		if !ok {
			continue
		}
		rawInputs["input_id"] = newValue
		classType, _ := node["class_type"].(string)
		switch classType {
		case "ComfyUIDeployExternalText", "ComfyUIDeployExternalTextAny":
			rawInputs["default_value"] = newValue
		case "ComfyUIDeployExternalNumber", "ComfyUIDeployExternalNumberInt", "ComfyUIDeployExternalNumberFloat", "ComfyUIDeployExternalBoolean", "ComfyUIDeployExternalSeed":
			rawInputs["default_value"] = newValue
		case "ComfyUIDeployExternalImage", "ComfyUIDeployExternalVideo":
			rawInputs["image"] = newValue
		case "ComfyUIDeployExternalAudio":
			rawInputs["audio_file"] = newValue
		case "ComfyUIDeployExternalFile":
			rawInputs["file_url"] = newValue
		case "ComfyUIDeployExternalEXR":
			rawInputs["exr_file"] = newValue
		case "ComfyUIDeployExternalFaceModel":
			rawInputs["face_model_url"] = newValue
		}
		graph[key] = node
	}
	updated, err := json.Marshal(graph)
	if err != nil {
		return workflowAPI
	}
	return updated
}
