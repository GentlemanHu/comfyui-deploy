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
	if !s.authorizeStatic(w, r) {
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

func (s *Server) authorizeStatic(w http.ResponseWriter, r *http.Request) bool {
	if strings.TrimSpace(s.cfg.LocalAuthPassword) == "" {
		return true
	}
	if isPublicStaticPath(r.URL.Path) {
		return true
	}
	if _, ok := s.basicAuthUser(r); ok {
		return true
	}
	w.Header().Set("WWW-Authenticate", `Basic realm="ComfyDeploy"`)
	http.Error(w, "Authorization required", http.StatusUnauthorized)
	return false
}

func isPublicStaticPath(path string) bool {
	if strings.HasPrefix(path, "/share/") {
		return true
	}
	for _, prefix := range []string{"/assets/", "/example-workflows/"} {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	switch path {
	case "/favicon.ico", "/robots.txt", "/manifest.webmanifest":
		return true
	default:
		return false
	}
}
