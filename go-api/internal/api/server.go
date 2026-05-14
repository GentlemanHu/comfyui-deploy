package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/auth"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/config"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/storage"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/store"
	"github.com/go-chi/chi/v5"
)

type Server struct {
	cfg     config.Config
	store   *store.Store
	storage *storage.S3
	logger  *slog.Logger
}

func New(cfg config.Config, st *store.Store, s3 *storage.S3, logger *slog.Logger) http.Handler {
	s := &Server{cfg: cfg, store: st, storage: s3, logger: logger}
	r := chi.NewRouter()
	r.Use(s.cors)
	r.Get("/health", s.health)
	r.Route("/api", func(r chi.Router) {
		r.Get("/auth-response/{request_id}", s.getAuthResponse)
		r.Post("/update-run", s.updateRun)
		r.Post("/machine-built", s.machineBuilt)
		r.Get("/file-upload", s.fileUploadURL)
		r.Get("/view", s.viewFile)
		r.Group(func(r chi.Router) {
			r.Use(s.requireBearer)
			r.Post("/auth-request/{request_id}", s.createAuthRequest)
			r.Get("/session", s.session)
			r.Get("/api-keys", s.listAPIKeys)
			r.Post("/api-keys", s.createAPIKey)
			r.Delete("/api-keys/{api_key_id}", s.revokeAPIKey)
			r.Get("/machines", s.listMachines)
			r.Post("/machines", s.createMachine)
			r.Get("/machines/{machine_id}", s.getMachine)
			r.Patch("/machines/{machine_id}", s.updateMachine)
			r.Delete("/machines/{machine_id}", s.disableMachine)
			r.Get("/machine", s.getMachineQuery)
			r.Get("/machine/{machine_id}", s.getMachine)
			r.Get("/upload-url", s.uploadURL)
			r.Post("/workflow", s.uploadWorkflow)
			r.Get("/workflows", s.listWorkflows)
			r.Get("/workflow/{workflow_id}", s.getWorkflow)
			r.Delete("/workflow/{workflow_id}", s.deleteWorkflow)
			r.Get("/workflow/{workflow_id}/deployments", s.listDeployments)
			r.Post("/workflow/{workflow_id}/deployments", s.createDeployment)
			r.Get("/workflow/{workflow_id}/runs", s.listRuns)
			r.Get("/workflow/{workflow_id}/versions", s.listWorkflowVersions)
			r.Get("/workflow/{workflow_id}/version/{version}", s.getWorkflowVersionByNumber)
			r.Get("/workflow-version/{version_id}", s.getWorkflowVersionByID)
			r.Get("/deployments", s.listAllDeployments)
			r.Delete("/deployments/{deployment_id}", s.deleteDeployment)
			r.Get("/run/{run_id}", s.getRun)
			r.Get("/run/{run_id}/outputs", s.getRunOutputs)
			r.Post("/run", s.createRun)
		})
			r.Get("/share/{share_id}", s.getSharedDeployment)
			r.Post("/share/{share_id}/clone-workflow", s.cloneSharedWorkflow)
			r.Post("/share/{share_id}/clone-machine", s.cloneSharedMachine)
			r.Patch("/share/{share_id}/settings", s.updateShareSettings)
			r.Delete("/share/{share_id}/settings", s.deleteShareSettings)
		})
	r.NotFound(s.staticOr404)
	return r
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) requireBearer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := auth.BearerToken(r)
		if token == "" {
			if user, ok := s.basicAuthUser(r); ok {
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, user)))
				return
			}
			writeJSON(w, http.StatusUnauthorized, apiError{Error: "Invalid or expired token"})
			return
		}
		user, err := auth.Parse(s.cfg.JWTSecret, token)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, apiError{Error: err.Error()})
			return
		}
		revoked, err := s.isRevokedAPIKey(r.Context(), token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		if revoked {
			writeJSON(w, http.StatusUnauthorized, apiError{Error: "Revoked token"})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, user)))
	})
}

func (s *Server) basicAuthUser(r *http.Request) (auth.User, bool) {
	if strings.TrimSpace(s.cfg.LocalAuthPassword) == "" {
		return auth.User{}, false
	}
	username, password, ok := r.BasicAuth()
	if !ok || password != s.cfg.LocalAuthPassword {
		return auth.User{}, false
	}
	username = strings.TrimSpace(username)
	if username == "" {
		return auth.User{}, false
	}
	if username != s.cfg.LocalAuthUserID && username != s.cfg.LocalAuthUserName {
		return auth.User{}, false
	}
	return auth.User{UserID: s.cfg.LocalAuthUserID, OrgID: s.cfg.LocalAuthOrgID}, true
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id": user.UserID,
		"org_id":  user.OrgID,
		"name":    s.cfg.LocalAuthUserName,
	})
}

type userContextKey struct{}

func currentUser(r *http.Request) auth.User {
	user, _ := r.Context().Value(userContextKey{}).(auth.User)
	return user
}

func (s *Server) isRevokedAPIKey(ctx context.Context, token string) (bool, error) {
	var revoked bool
	err := s.store.DB.QueryRowContext(ctx, `SELECT revoked FROM comfyui_deploy.api_keys WHERE key = $1`, token).Scan(&revoked)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return revoked, err
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write json", "error", err)
	}
}

func readJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 64<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func nullString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: strings.TrimSpace(value) != ""}
}

func ptrNullString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func scanRawMessage(value []byte) json.RawMessage {
	if len(value) == 0 {
		return json.RawMessage("null")
	}
	return json.RawMessage(value)
}

func nowPlusWeek() time.Time {
	return time.Now().Add(7 * 24 * time.Hour)
}
