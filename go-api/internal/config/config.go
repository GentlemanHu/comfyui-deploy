package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Addr                  string
	PostgresURL           string
	JWTSecret             string
	LocalAuthUserID       string
	LocalAuthUserName     string
	LocalAuthOrgID        string
	LocalAuthOrgName      string
	LocalAuthPassword     string
	SpacesEndpoint        string
	SpacesPublicEndpoint  string
	SpacesEndpointCDN     string
	SpacesRegion          string
	SpacesBucket          string
	SpacesKey             string
	SpacesSecret          string
	SpacesForcePathStyle  bool
	SpacesCDNNoBucket     bool
	StaticDir             string
	EnableSchemaMigration bool
	MaxUploadBytes        int64
}

func Load() Config {
	return Config{
		Addr:                  env("GO_API_ADDR", ":3000"),
		PostgresURL:           env("POSTGRES_URL", "postgres://postgres:postgres@postgres:5432/verceldb?sslmode=disable"),
		JWTSecret:             mustEnv("JWT_SECRET"),
		LocalAuthUserID:       env("LOCAL_AUTH_USER_ID", "local-admin"),
		LocalAuthUserName:     env("LOCAL_AUTH_USER_NAME", "Local Admin"),
		LocalAuthOrgID:        os.Getenv("LOCAL_AUTH_ORG_ID"),
		LocalAuthOrgName:      env("LOCAL_AUTH_ORG_NAME", "Local"),
		LocalAuthPassword:     os.Getenv("LOCAL_AUTH_PASSWORD"),
		SpacesEndpoint:        env("SPACES_ENDPOINT", "http://minio:9000"),
		SpacesPublicEndpoint:  env("SPACES_PUBLIC_ENDPOINT", env("SPACES_ENDPOINT", "http://minio:9000")),
		SpacesEndpointCDN:     env("SPACES_ENDPOINT_CDN", env("SPACES_PUBLIC_ENDPOINT", env("SPACES_ENDPOINT", "http://minio:9000"))),
		SpacesRegion:          env("SPACES_REGION", "nyc3"),
		SpacesBucket:          env("SPACES_BUCKET", "comfyui-deploy"),
		SpacesKey:             env("SPACES_KEY", "comfydeploy"),
		SpacesSecret:          mustEnv("SPACES_SECRET"),
		SpacesForcePathStyle:  envBool("SPACES_CDN_FORCE_PATH_STYLE", true),
		SpacesCDNNoBucket:     envBool("SPACES_CDN_DONT_INCLUDE_BUCKET", false),
		StaticDir:             env("COMFYDEPLOY_STATIC_DIR", "/app/static"),
		EnableSchemaMigration: envBool("GO_API_MIGRATE", true),
		MaxUploadBytes:        envInt64("GO_API_MAX_UPLOAD_BYTES", 50*1024*1024),
	}
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func mustEnv(key string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		panic(key + " is required")
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
