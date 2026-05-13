package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (s *Server) staticOr404(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeJSON(w, http.StatusNotFound, apiError{Error: "not found"})
		return
	}
	path := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
	if path == "." || path == "/" {
		path = "index.html"
	}
	fullPath := filepath.Join(s.cfg.StaticDir, path)
	if !strings.HasPrefix(fullPath, filepath.Clean(s.cfg.StaticDir)) {
		http.NotFound(w, r)
		return
	}
	if _, err := os.Stat(fullPath); err != nil {
		fullPath = filepath.Join(s.cfg.StaticDir, "index.html")
	}
	http.ServeFile(w, r, fullPath)
}
