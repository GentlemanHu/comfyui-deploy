package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type apiKeyRecord struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Key       string    `json:"key,omitempty"`
	MaskedKey string    `json:"masked_key,omitempty"`
	Revoked   bool      `json:"revoked"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type createAPIKeyRequest struct {
	Name string `json:"name"`
}

func (s *Server) listAPIKeys(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT id, name, key, revoked, created_at, updated_at
		FROM comfyui_deploy.api_keys
		WHERE (($1::text <> '' AND org_id = $1) OR ($1::text = '' AND user_id = $2 AND org_id IS NULL))
		ORDER BY created_at DESC
	`, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()

	items := make([]apiKeyRecord, 0)
	for rows.Next() {
		var item apiKeyRecord
		if err := rows.Scan(&item.ID, &item.Name, &item.Key, &item.Revoked, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		item.MaskedKey = maskAPIKey(item.Key)
		item.Key = ""
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createAPIKey(w http.ResponseWriter, r *http.Request) {
	var req createAPIKeyRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{Error: err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "name is required"})
		return
	}
	user := currentUser(r)
	token, err := auth.SignAPIKey(s.cfg.JWTSecret, user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	id := uuid.NewString()
	var item apiKeyRecord
	err = s.store.DB.QueryRowContext(r.Context(), `
		INSERT INTO comfyui_deploy.api_keys (id, key, name, user_id, org_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, revoked, created_at, updated_at
	`, id, token, req.Name, user.UserID, nullString(user.OrgID)).Scan(&item.ID, &item.Name, &item.Revoked, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	item.Key = token
	item.MaskedKey = maskAPIKey(token)
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) revokeAPIKey(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	id := chi.URLParam(r, "api_key_id")
	res, err := s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.api_keys
		SET revoked = true, updated_at = now()
		WHERE id = $1
		  AND (($2::text <> '' AND org_id = $2) OR ($2::text = '' AND user_id = $3 AND org_id IS NULL))
	`, id, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, apiError{Error: "api key not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"revoked": true})
}

func notFoundOrInternal(w http.ResponseWriter, err error, message string) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, apiError{Error: message})
		return true
	}
	writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
	return true
}

func maskAPIKey(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}
