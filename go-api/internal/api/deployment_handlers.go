package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type deploymentRecord struct {
	ID                string          `json:"id"`
	UserID            string          `json:"user_id"`
	OrgID             *string         `json:"org_id"`
	WorkflowID        string          `json:"workflow_id"`
	WorkflowVersionID string          `json:"workflow_version_id"`
	MachineID         string          `json:"machine_id"`
	Environment       string          `json:"environment"`
	ShareSlug         *string         `json:"share_slug"`
	Description       *string         `json:"description"`
	ShowcaseMedia     json.RawMessage `json:"showcase_media"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	MachineName       *string         `json:"machine_name,omitempty"`
	Version           *int            `json:"version,omitempty"`
}

type createDeploymentRequest struct {
	VersionID   string `json:"version_id"`
	MachineID   string `json:"machine_id"`
	Environment string `json:"environment"`
}

func (s *Server) listDeployments(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "workflow not found"})
		return
	}
	items, err := s.fetchDeployments(r, "d.workflow_id = $1", workflowID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) listAllDeployments(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	items, err := s.fetchDeployments(r, `(($1::text <> '' AND d.org_id = $1) OR ($1::text = '' AND d.user_id = $2 AND d.org_id IS NULL))`, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createDeployment(w http.ResponseWriter, r *http.Request) {
	var req createDeploymentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	workflowID := chi.URLParam(r, "workflow_id")
	req.VersionID = strings.TrimSpace(req.VersionID)
	req.MachineID = strings.TrimSpace(req.MachineID)
	req.Environment = strings.TrimSpace(req.Environment)
	if req.Environment == "" {
		req.Environment = "production"
	}
	if req.VersionID == "" || req.MachineID == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "version_id and machine_id are required"})
		return
	}
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "workflow not found"})
		return
	}
	if _, err := s.fetchMachine(r, req.MachineID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "machine not found"})
		return
	}
	user := currentUser(r)
	workflowName := ""
	_ = s.store.DB.QueryRowContext(r.Context(), `SELECT name FROM comfyui_deploy.workflows WHERE id = $1`, workflowID).Scan(&workflowName)
	shareSlug := sql.NullString{}
	if req.Environment == "public-share" {
		shareSlug = nullString(slugify(s.cfg.LocalAuthUserName + " " + workflowName + " " + uuid.NewString()[:8]))
	}
	var item deploymentRecord
	var orgID sql.NullString
	var selectedShareSlug sql.NullString
	var description sql.NullString
	var existingID string
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT id
		FROM comfyui_deploy.deployments
		WHERE workflow_id = $1 AND environment = $2::deployment_environment
		LIMIT 1
	`, workflowID, req.Environment).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	if existingID != "" {
		err = s.store.DB.QueryRowContext(r.Context(), `
			UPDATE comfyui_deploy.deployments
			SET workflow_version_id = $2,
			    machine_id = $3,
			    org_id = $4,
			    updated_at = now()
			WHERE id = $1
			RETURNING id, user_id, org_id, workflow_id, workflow_version_id, machine_id, environment::text,
			          share_slug, description, COALESCE(showcase_media, 'null'::jsonb), created_at, updated_at
		`, existingID, req.VersionID, req.MachineID, nullString(user.OrgID)).Scan(
			&item.ID, &item.UserID, &orgID, &item.WorkflowID, &item.WorkflowVersionID, &item.MachineID, &item.Environment,
			&selectedShareSlug, &description, &item.ShowcaseMedia, &item.CreatedAt, &item.UpdatedAt,
		)
	} else {
		err = s.store.DB.QueryRowContext(r.Context(), `
		INSERT INTO comfyui_deploy.deployments
			(id, user_id, org_id, workflow_id, workflow_version_id, machine_id, environment, share_slug)
		VALUES ($1, $2, $3, $4, $5, $6, $7::deployment_environment, $8)
		RETURNING id, user_id, org_id, workflow_id, workflow_version_id, machine_id, environment::text,
		          share_slug, description, COALESCE(showcase_media, 'null'::jsonb), created_at, updated_at
	`, uuid.NewString(), user.UserID, nullString(user.OrgID), workflowID, req.VersionID, req.MachineID, req.Environment, shareSlug).Scan(
			&item.ID, &item.UserID, &orgID, &item.WorkflowID, &item.WorkflowVersionID, &item.MachineID, &item.Environment,
			&selectedShareSlug, &description, &item.ShowcaseMedia, &item.CreatedAt, &item.UpdatedAt,
		)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	item.OrgID = ptrNullString(orgID)
	item.ShareSlug = ptrNullString(selectedShareSlug)
	item.Description = ptrNullString(description)
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) deleteDeployment(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	id := chi.URLParam(r, "deployment_id")
	res, err := s.store.DB.ExecContext(r.Context(), `
		DELETE FROM comfyui_deploy.deployments
		WHERE id = $1
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
	`, id, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, apiError{Error: "deployment not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (s *Server) getSharedDeployment(w http.ResponseWriter, r *http.Request) {
	shareID := chi.URLParam(r, "share_id")
	var item deploymentRecord
	var workflowName string
	var orgID sql.NullString
	var shareSlug sql.NullString
	var description sql.NullString
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT d.id, d.user_id, d.org_id, d.workflow_id, d.workflow_version_id, d.machine_id, d.environment::text,
		       d.share_slug, d.description, COALESCE(d.showcase_media, 'null'::jsonb), d.created_at, d.updated_at,
		       w.name
		FROM comfyui_deploy.deployments d
		JOIN comfyui_deploy.workflows w ON w.id = d.workflow_id
		WHERE d.environment = 'public-share'
		  AND (d.id::text = $1 OR d.share_slug = $1)
		LIMIT 1
	`, shareID).Scan(
		&item.ID, &item.UserID, &orgID, &item.WorkflowID, &item.WorkflowVersionID, &item.MachineID, &item.Environment,
		&shareSlug, &description, &item.ShowcaseMedia, &item.CreatedAt, &item.UpdatedAt, &workflowName,
	)
	if notFoundOrInternal(w, err, "share not found") {
		return
	}
	item.OrgID = ptrNullString(orgID)
	item.ShareSlug = ptrNullString(shareSlug)
	item.Description = ptrNullString(description)
	writeJSON(w, http.StatusOK, map[string]any{"deployment": item, "workflow_name": workflowName})
}

func (s *Server) fetchDeployments(r *http.Request, where string, args ...any) ([]deploymentRecord, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT d.id, d.user_id, d.org_id, d.workflow_id, d.workflow_version_id, d.machine_id, d.environment::text,
		       d.share_slug, d.description, COALESCE(d.showcase_media, 'null'::jsonb), d.created_at, d.updated_at,
		       m.name, wv.version
		FROM comfyui_deploy.deployments d
		LEFT JOIN comfyui_deploy.machines m ON m.id = d.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = d.workflow_version_id
		WHERE `+where+`
		ORDER BY d.environment DESC, d.updated_at DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]deploymentRecord, 0)
	for rows.Next() {
		var item deploymentRecord
		var orgID sql.NullString
		var shareSlug sql.NullString
		var description sql.NullString
		var machineName sql.NullString
		var version sql.NullInt64
		if err := rows.Scan(
			&item.ID, &item.UserID, &orgID, &item.WorkflowID, &item.WorkflowVersionID, &item.MachineID, &item.Environment,
			&shareSlug, &description, &item.ShowcaseMedia, &item.CreatedAt, &item.UpdatedAt, &machineName, &version,
		); err != nil {
			return nil, err
		}
		item.OrgID = ptrNullString(orgID)
		item.ShareSlug = ptrNullString(shareSlug)
		item.Description = ptrNullString(description)
		item.MachineName = ptrNullString(machineName)
		if version.Valid {
			v := int(version.Int64)
			item.Version = &v
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" {
		return uuid.NewString()
	}
	return value
}
