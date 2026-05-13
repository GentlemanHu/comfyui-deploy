package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/api"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/config"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/storage"
	"github.com/gentlemanhu/comfyui-deploy/go-api/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()
	ctx := context.Background()

	st, err := store.Open(ctx, cfg.PostgresURL)
	if err != nil {
		logger.Error("open postgres", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	if cfg.EnableSchemaMigration {
		if err := st.Migrate(ctx); err != nil {
			logger.Error("migrate schema", "error", err)
			os.Exit(1)
		}
		if err := st.EnsureLocalUser(ctx, cfg.LocalAuthUserID, cfg.LocalAuthUserName); err != nil {
			logger.Error("ensure local user", "error", err)
			os.Exit(1)
		}
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.New(cfg, st, storage.NewS3(cfg), logger),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("listening", "addr", cfg.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("http server", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "error", err)
	}
}
