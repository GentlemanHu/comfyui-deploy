package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type rowScanner interface {
	Scan(dest ...any) error
}

func (s *Server) ensureWorkflowOwner(r *http.Request, workflowID string) error {
	user := currentUser(r)
	var id string
	return s.store.DB.QueryRowContext(r.Context(), `
		SELECT id
		FROM comfyui_deploy.workflows
		WHERE id = $1
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
	`, workflowID, user.OrgID, user.UserID).Scan(&id)
}

func (s *Server) fetchVersions(r *http.Request, workflowID string, limit, offset int) ([]workflowVersion, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT workflow_id, id, workflow, workflow_api, snapshot, version, created_at, updated_at
		FROM comfyui_deploy.workflow_versions
		WHERE workflow_id = $1
		ORDER BY version DESC
		LIMIT $2 OFFSET $3
	`, workflowID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	versions := make([]workflowVersion, 0)
	for rows.Next() {
		v, err := scanVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, rows.Err()
}

func (s *Server) fetchVersion(r *http.Request, where string, args ...any) (workflowVersion, error) {
	query := `
		SELECT workflow_id, id, workflow, workflow_api, snapshot, version, created_at, updated_at
		FROM comfyui_deploy.workflow_versions
		WHERE ` + where + `
		LIMIT 1
	`
	return scanVersion(s.store.DB.QueryRowContext(r.Context(), query, args...))
}

func scanVersion(row rowScanner) (workflowVersion, error) {
	var v workflowVersion
	var workflow []byte
	var workflowAPI []byte
	var snapshot []byte
	err := row.Scan(&v.WorkflowID, &v.ID, &workflow, &workflowAPI, &snapshot, &v.Version, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return v, err
	}
	v.Workflow = scanRawMessage(workflow)
	v.WorkflowAPI = scanRawMessage(workflowAPI)
	v.Snapshot = scanRawMessage(snapshot)
	return v, nil
}

func scanWorkflowMap(rows *sql.Rows) (map[string]any, error) {
	var id, userID, name string
	var orgID sql.NullString
	var createdAt, updatedAt time.Time
	if err := rows.Scan(&id, &userID, &orgID, &name, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return workflowMap(id, userID, ptrNullString(orgID), name, createdAt, updatedAt), nil
}

func scanWorkflowRow(row rowScanner) (map[string]any, error) {
	var id, userID, name string
	var orgID sql.NullString
	var createdAt, updatedAt time.Time
	if err := row.Scan(&id, &userID, &orgID, &name, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return workflowMap(id, userID, ptrNullString(orgID), name, createdAt, updatedAt), nil
}

func workflowMap(id, userID string, orgID *string, name string, createdAt, updatedAt time.Time) map[string]any {
	return map[string]any{
		"id":          id,
		"user_id":     userID,
		"org_id":      orgID,
		"name":        name,
		"created_at":  createdAt,
		"updated_at":  updatedAt,
		"user_icon":   "",
		"user_name":   "Local",
		"description": "",
		"cover_image": "",
		"pinned":      false,
	}
}

func queryInt(r *http.Request, key string, fallback int) int {
	value, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return value
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(value, minValue int) int {
	if value < minValue {
		return minValue
	}
	return value
}

func isFullWorkflowGraph(raw json.RawMessage) bool {
	var value struct {
		Nodes []any `json:"nodes"`
	}
	return json.Unmarshal(raw, &value) == nil && value.Nodes != nil
}
