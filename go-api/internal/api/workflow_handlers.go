package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type uploadWorkflowRequest struct {
	WorkflowID   string          `json:"workflow_id"`
	WorkflowName string          `json:"workflow_name"`
	Workflow     json.RawMessage `json:"workflow"`
	WorkflowAPI  json.RawMessage `json:"workflow_api"`
	Snapshot     json.RawMessage `json:"snapshot"`
}

func (s *Server) uploadWorkflow(w http.ResponseWriter, r *http.Request) {
	var req uploadWorkflowRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	user := currentUser(r)
	if user.UserID == "" {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: "Invalid user_id"})
		return
	}
	if len(req.Workflow) == 0 || len(req.WorkflowAPI) == 0 || len(req.Snapshot) == 0 {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "workflow, workflow_api and snapshot are required"})
		return
	}
	if req.WorkflowID == "" {
		if req.WorkflowName == "" {
			writeJSON(w, http.StatusBadRequest, apiError{Error: "workflow_name is required"})
			return
		}
		workflowID := uuid.NewString()
		_, err := s.store.DB.ExecContext(r.Context(), `
			INSERT INTO comfyui_deploy.workflows (id, user_id, org_id, name)
			VALUES ($1, $2, $3, $4)
		`, workflowID, user.UserID, nullString(user.OrgID), req.WorkflowName)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		versionID := uuid.NewString()
		_, err = s.store.DB.ExecContext(r.Context(), `
			INSERT INTO comfyui_deploy.workflow_versions (id, workflow_id, workflow, workflow_api, snapshot, version)
			VALUES ($1, $2, $3, $4, $5, 1)
		`, versionID, workflowID, req.Workflow, req.WorkflowAPI, req.Snapshot)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"workflow_id": workflowID, "version": 1})
		return
	}
	if err := s.ensureWorkflowOwner(r, req.WorkflowID); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	var version int
	err := s.store.DB.QueryRowContext(r.Context(), `
		INSERT INTO comfyui_deploy.workflow_versions (id, workflow_id, workflow, workflow_api, snapshot, version)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, (
			SELECT COALESCE(MAX(version), 0) + 1 FROM comfyui_deploy.workflow_versions WHERE workflow_id = $1
		))
		RETURNING version
	`, req.WorkflowID, req.Workflow, req.WorkflowAPI, req.Snapshot).Scan(&version)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	_, _ = s.store.DB.ExecContext(r.Context(), `UPDATE comfyui_deploy.workflows SET updated_at = now() WHERE id = $1`, req.WorkflowID)
	writeJSON(w, http.StatusOK, map[string]any{"workflow_id": req.WorkflowID, "version": version})
}

func (s *Server) listWorkflows(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	limit := clampInt(queryInt(r, "limit", 20), 1, 100)
	offset := maxInt(queryInt(r, "offset", 0), 0)
	search := "%" + r.URL.Query().Get("search") + "%"
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT id, user_id, org_id, name, created_at, updated_at
		FROM comfyui_deploy.workflows
		WHERE (($1::text <> '' AND org_id = $1) OR ($1::text = '' AND user_id = $2 AND org_id IS NULL))
		  AND ($3 = '%%' OR name ILIKE $3)
		ORDER BY updated_at DESC
		LIMIT $4 OFFSET $5
	`, user.OrgID, user.UserID, search, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		item, err := scanWorkflowMap(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) getWorkflow(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "No workflow found"})
		return
	}
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT id, user_id, org_id, name, created_at, updated_at
		FROM comfyui_deploy.workflows WHERE id = $1
	`, workflowID)
	item, err := scanWorkflowRow(row)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	versions, err := s.fetchVersions(r, workflowID, 1, 0)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	item["versions"] = versions
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) listWorkflowVersions(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "No workflow found"})
		return
	}
	versions, err := s.fetchVersions(r, workflowID, clampInt(queryInt(r, "limit", 20), 1, 100), maxInt(queryInt(r, "offset", 0), 0))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, versions)
}

func (s *Server) getWorkflowVersionByNumber(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	version, _ := strconv.Atoi(chi.URLParam(r, "version"))
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "No workflow found"})
		return
	}
	v, err := s.fetchVersion(r, `workflow_id = $1 AND version = $2`, workflowID, version)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, sql.ErrNoRows) {
			status = http.StatusNotFound
		}
		writeJSON(w, status, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (s *Server) getWorkflowVersionByID(w http.ResponseWriter, r *http.Request) {
	versionID := chi.URLParam(r, "version_id")
	v, err := s.fetchVersion(r, `id = $1`, versionID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "No version found"})
		return
	}
	if err := s.ensureWorkflowOwner(r, v.WorkflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "No version found"})
		return
	}
	writeJSON(w, http.StatusOK, v)
}
