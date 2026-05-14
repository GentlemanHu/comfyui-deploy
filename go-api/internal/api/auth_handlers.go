package api

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/auth"
	"github.com/go-chi/chi/v5"
)

func (s *Server) getAuthResponse(w http.ResponseWriter, r *http.Request) {
	requestID := chi.URLParam(r, "request_id")
	var userID sql.NullString
	var orgID sql.NullString
	var apiHash sql.NullString
	err := s.store.DB.QueryRowContext(r.Context(), `
		SELECT user_id, org_id, api_hash
		FROM comfyui_deploy.auth_requests
		WHERE request_id = $1
	`, requestID).Scan(&userID, &orgID, &apiHash)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusCreated, map[string]string{"message": "Not ready yet."})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	if apiHash.Valid {
		writeJSON(w, http.StatusCreated, map[string]string{"message": "Already used."})
		return
	}
	if !userID.Valid {
		writeJSON(w, http.StatusCreated, map[string]string{"message": "Not ready yet."})
		return
	}
	token, err := auth.Sign(s.cfg.JWTSecret, auth.User{UserID: userID.String, OrgID: orgID.String}, 7*24*time.Hour)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	_, err = s.store.DB.ExecContext(r.Context(), `
		UPDATE comfyui_deploy.auth_requests
		SET api_hash = $1, expired_date = $2, updated_at = now()
		WHERE request_id = $3
	`, auth.HashToken(token), nowPlusWeek(), requestID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	name := s.cfg.LocalAuthUserName
	if orgID.Valid && s.cfg.LocalAuthOrgName != "" {
		name = s.cfg.LocalAuthOrgName
	}
	writeJSON(w, http.StatusOK, map[string]string{"api_key": token, "name": name})
}

func (s *Server) createAuthRequest(w http.ResponseWriter, r *http.Request) {
	requestID := chi.URLParam(r, "request_id")
	if requestID == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "request_id is required"})
		return
	}
	user := currentUser(r)
	_, err := s.store.DB.ExecContext(r.Context(), `
		INSERT INTO comfyui_deploy.auth_requests (request_id, user_id, org_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (request_id) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    org_id = EXCLUDED.org_id,
		    api_hash = NULL,
		    expired_date = NULL,
		    updated_at = now()
	`, requestID, user.UserID, nullString(user.OrgID))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Auth request created, you may now return to your application."})
}
