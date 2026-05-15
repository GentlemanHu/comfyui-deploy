package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *Server) uploadURL(w http.ResponseWriter, r *http.Request) {
	contentType := r.URL.Query().Get("type")
	if contentType == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "type is required"})
		return
	}
	size, err := strconv.ParseInt(r.URL.Query().Get("file_size"), 10, 64)
	if err != nil || size <= 0 {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "file_size must be a positive number"})
		return
	}
	if size > s.cfg.MaxUploadBytes {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "file size exceeds limit"})
		return
	}
	ext := strings.TrimPrefix(extensionForContentType(contentType, ""), ".")
	fileID := "img-" + uuid.NewString()
	key := "inputs/" + fileID + "." + ext
	url, err := s.storage.PresignPut(r.Context(), key, contentType, true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"upload_url":   url,
		"file_id":      fileID,
		"download_url": s.storage.PublicURL(key),
		"include_acl":  true,
	})
}

func (s *Server) fileUploadURL(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	fileName := query.Get("file_name")
	runID := query.Get("run_id")
	contentType := query.Get("type")
	if fileName == "" || runID == "" || contentType == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "file_name, run_id and type are required"})
		return
	}
	key := "outputs/runs/" + runID + "/" + fileName
	url, err := s.storage.PresignPut(r.Context(), key, contentType, true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": url, "include_acl": true})
}

func (s *Server) viewFile(w http.ResponseWriter, r *http.Request) {
	file := strings.TrimPrefix(strings.TrimSpace(r.URL.Query().Get("file")), "/")
	if file == "" {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "file is required"})
		return
	}
	if !isSafeViewKey(file) {
		writeJSON(w, http.StatusBadRequest, apiError{Error: "file path is not allowed"})
		return
	}
	u, err := s.storage.PresignGet(r.Context(), file, 15*time.Minute)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	http.Redirect(w, r, u, http.StatusTemporaryRedirect)
}

func isSafeViewKey(file string) bool {
	if strings.Contains(file, "..") || strings.Contains(file, "\\") {
		return false
	}
	return strings.HasPrefix(file, "outputs/runs/") || strings.HasPrefix(file, "inputs/")
}
