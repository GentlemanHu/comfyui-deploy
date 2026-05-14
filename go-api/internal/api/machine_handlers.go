package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type machineRecord struct {
	ID        string          `json:"id"`
	UserID    string          `json:"user_id"`
	OrgID     *string         `json:"org_id"`
	Name      string          `json:"name"`
	Endpoint  string          `json:"endpoint"`
	AuthToken *string         `json:"auth_token,omitempty"`
	Type      string          `json:"type"`
	Status    string          `json:"status"`
	Disabled  bool            `json:"disabled"`
	Snapshot  json.RawMessage `json:"snapshot,omitempty"`
	Models    json.RawMessage `json:"models,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type upsertMachineRequest struct {
	Name      string          `json:"name"`
	Endpoint  string          `json:"endpoint"`
	AuthToken *string         `json:"auth_token"`
	Type      string          `json:"type"`
	Status    string          `json:"status"`
	Snapshot  json.RawMessage `json:"snapshot"`
	Models    json.RawMessage `json:"models"`
}

type machineBuiltRequest struct {
	MachineID string `json:"machine_id"`
	Endpoint  string `json:"endpoint"`
	BuildLog  string `json:"build_log"`
}

func (s *Server) listMachines(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT id, user_id, org_id, name, endpoint, auth_token, type::text, status::text, disabled,
		       COALESCE(snapshot, 'null'::jsonb), COALESCE(models, 'null'::jsonb), created_at, updated_at
		FROM comfyui_deploy.machines
		WHERE disabled = false
		  AND (($1::text <> '' AND org_id = $1) OR ($1::text = '' AND user_id = $2 AND org_id IS NULL))
		ORDER BY updated_at DESC
	`, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()
	items := make([]machineRecord, 0)
	for rows.Next() {
		item, err := scanMachineRecord(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createMachine(w http.ResponseWriter, r *http.Request) {
	req, ok := s.readMachineRequest(w, r, true)
	if !ok {
		return
	}
	user := currentUser(r)
	var item machineRecord
	var orgID sql.NullString
	var authToken sql.NullString
	err := s.store.DB.QueryRowContext(r.Context(), `
		INSERT INTO comfyui_deploy.machines (id, user_id, org_id, name, endpoint, auth_token, type, status, snapshot, models)
		VALUES ($1, $2, $3, $4, $5, $6, $7::machine_type, $8::machine_status, $9, $10)
		RETURNING id, user_id, org_id, name, endpoint, auth_token, type::text, status::text, disabled,
		          COALESCE(snapshot, 'null'::jsonb), COALESCE(models, 'null'::jsonb), created_at, updated_at
	`, uuid.NewString(), user.UserID, nullString(user.OrgID), req.Name, req.Endpoint, req.AuthToken, req.Type, req.Status, jsonOrNull(req.Snapshot), jsonOrNull(req.Models)).Scan(
		&item.ID, &item.UserID, &orgID, &item.Name, &item.Endpoint, &authToken, &item.Type, &item.Status, &item.Disabled,
		&item.Snapshot, &item.Models, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	item.OrgID = ptrNullString(orgID)
	item.AuthToken = ptrNullString(authToken)
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) getMachine(w http.ResponseWriter, r *http.Request) {
	item, err := s.fetchMachine(r, chi.URLParam(r, "machine_id"))
	if notFoundOrInternal(w, err, "machine not found") {
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) updateMachine(w http.ResponseWriter, r *http.Request) {
	req, ok := s.readMachineRequest(w, r, false)
	if !ok {
		return
	}
	user := currentUser(r)
	id := chi.URLParam(r, "machine_id")
	var item machineRecord
	var orgID sql.NullString
	var authToken sql.NullString
	err := s.store.DB.QueryRowContext(r.Context(), `
		UPDATE comfyui_deploy.machines
		SET name = COALESCE(NULLIF($4, ''), name),
		    endpoint = COALESCE(NULLIF($5, ''), endpoint),
		    auth_token = COALESCE($6, auth_token),
		    type = COALESCE(NULLIF($7, '')::machine_type, type),
		    status = COALESCE(NULLIF($8, '')::machine_status, status),
		    snapshot = COALESCE($9::jsonb, snapshot),
		    models = COALESCE($10::jsonb, models),
		    updated_at = now()
		WHERE id = $1 AND disabled = false
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
		RETURNING id, user_id, org_id, name, endpoint, auth_token, type::text, status::text, disabled,
		          COALESCE(snapshot, 'null'::jsonb), COALESCE(models, 'null'::jsonb), created_at, updated_at
	`, id, user.OrgID, user.UserID, req.Name, req.Endpoint, req.AuthToken, req.Type, req.Status, jsonOrNull(req.Snapshot), jsonOrNull(req.Models)).Scan(
		&item.ID, &item.UserID, &orgID, &item.Name, &item.Endpoint, &authToken, &item.Type, &item.Status, &item.Disabled,
		&item.Snapshot, &item.Models, &item.CreatedAt, &item.UpdatedAt,
	)
	if notFoundOrInternal(w, err, "machine not found") {
		return
	}
	item.OrgID = ptrNullString(orgID)
	item.AuthToken = ptrNullString(authToken)
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) disableMachine(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	id := chi.URLParam(r, "machine_id")
	res, err := s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.machines
		SET disabled = true, updated_at = now()
		WHERE id = $1
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
	`, id, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, apiError{Error: "machine not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"disabled": true})
}

func (s *Server) machineBuilt(w http.ResponseWriter, r *http.Request) {
	var req machineBuiltRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	req.MachineID = strings.TrimSpace(req.MachineID)
	req.Endpoint = strings.TrimRight(strings.TrimSpace(req.Endpoint), "/")
	if req.MachineID == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "machine_id is required"})
		return
	}
	status := "error"
	if req.Endpoint != "" {
		status = "ready"
	}
	_, err := s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.machines
		SET status = $2::machine_status,
		    endpoint = COALESCE(NULLIF($3, ''), endpoint),
		    build_log = $4,
		    updated_at = now()
		WHERE id = $1
	`, req.MachineID, status, req.Endpoint, nullString(req.BuildLog))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "success"})
}

func (s *Server) readMachineRequest(w http.ResponseWriter, r *http.Request, creating bool) (upsertMachineRequest, bool) {
	var req upsertMachineRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return req, false
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Endpoint = strings.TrimRight(strings.TrimSpace(req.Endpoint), "/")
	req.Type = strings.TrimSpace(req.Type)
	req.Status = strings.TrimSpace(req.Status)
	if req.Type == "" {
		req.Type = "classic"
	}
	if req.Status == "" {
		req.Status = "ready"
	}
	if req.AuthToken != nil {
		token := strings.TrimSpace(*req.AuthToken)
		req.AuthToken = &token
	}
	if creating && (req.Name == "" || req.Endpoint == "") {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "name and endpoint are required"})
		return req, false
	}
	return req, true
}

func (s *Server) fetchMachine(r *http.Request, id string) (machineRecord, error) {
	user := currentUser(r)
	var item machineRecord
	var orgID sql.NullString
	var authToken sql.NullString
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT id, user_id, org_id, name, endpoint, auth_token, type::text, status::text, disabled,
		       COALESCE(snapshot, 'null'::jsonb), COALESCE(models, 'null'::jsonb), created_at, updated_at
		FROM comfyui_deploy.machines
		WHERE id = $1 AND disabled = false
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
	`, id, user.OrgID, user.UserID).Scan(
		&item.ID, &item.UserID, &orgID, &item.Name, &item.Endpoint, &authToken, &item.Type, &item.Status, &item.Disabled,
		&item.Snapshot, &item.Models, &item.CreatedAt, &item.UpdatedAt,
	)
	item.OrgID = ptrNullString(orgID)
	item.AuthToken = ptrNullString(authToken)
	return item, err
}

func scanMachineRecord(row rowScanner) (machineRecord, error) {
	var item machineRecord
	var orgID sql.NullString
	var authToken sql.NullString
	err := row.Scan(
		&item.ID, &item.UserID, &orgID, &item.Name, &item.Endpoint, &authToken, &item.Type, &item.Status, &item.Disabled,
		&item.Snapshot, &item.Models, &item.CreatedAt, &item.UpdatedAt,
	)
	item.OrgID = ptrNullString(orgID)
	item.AuthToken = ptrNullString(authToken)
	return item, err
}

func jsonOrNull(value json.RawMessage) any {
	if len(value) == 0 {
		return nil
	}
	return value
}
