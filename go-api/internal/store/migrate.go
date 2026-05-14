package store

import (
	"context"
	"database/sql"
)

func (s *Store) Migrate(ctx context.Context) error {
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
		`CREATE SCHEMA IF NOT EXISTS comfyui_deploy`,
		`DO $$ BEGIN CREATE TYPE workflow_run_status AS ENUM('not-started','running','uploading','success','failed'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN CREATE TYPE deployment_environment AS ENUM('staging','production','public-share'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN CREATE TYPE workflow_run_origin AS ENUM('manual','api','public-share'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'workflow_run_status' AND e.enumlabel = 'uploading') THEN ALTER TYPE workflow_run_status ADD VALUE 'uploading'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'deployment_environment' AND e.enumlabel = 'public-share') THEN ALTER TYPE deployment_environment ADD VALUE 'public-share'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'workflow_run_origin' AND e.enumlabel = 'public-share') THEN ALTER TYPE workflow_run_origin ADD VALUE 'public-share'; END IF; END $$`,
		`DO $$ BEGIN CREATE TYPE machine_type AS ENUM('classic','runpod-serverless','modal-serverless','comfy-deploy-serverless'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN CREATE TYPE machine_status AS ENUM('ready','building','error'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN CREATE TYPE machine_gpu AS ENUM('T4','A10G','A100'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'machine_type' AND e.enumlabel = 'runpod-serverless') THEN ALTER TYPE machine_type ADD VALUE 'runpod-serverless'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'machine_type' AND e.enumlabel = 'modal-serverless') THEN ALTER TYPE machine_type ADD VALUE 'modal-serverless'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'machine_type' AND e.enumlabel = 'comfy-deploy-serverless') THEN ALTER TYPE machine_type ADD VALUE 'comfy-deploy-serverless'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'machine_gpu' AND e.enumlabel = 'A10G') THEN ALTER TYPE machine_gpu ADD VALUE 'A10G'; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'machine_gpu' AND e.enumlabel = 'A100') THEN ALTER TYPE machine_gpu ADD VALUE 'A100'; END IF; END $$`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.users (id text PRIMARY KEY, username text NOT NULL, name text NOT NULL, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.workflows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES comfyui_deploy.users(id) ON DELETE cascade, org_id text, name text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.workflow_versions (workflow_id uuid NOT NULL REFERENCES comfyui_deploy.workflows(id) ON DELETE cascade, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workflow jsonb, workflow_api jsonb, version integer NOT NULL, snapshot jsonb, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.machines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES comfyui_deploy.users(id) ON DELETE cascade, name text NOT NULL, org_id text, endpoint text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL, disabled boolean DEFAULT false NOT NULL, auth_token text, type machine_type DEFAULT 'classic' NOT NULL, status machine_status DEFAULT 'ready' NOT NULL, snapshot jsonb, models jsonb, gpu machine_gpu, build_machine_instance_id text, build_log text)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.workflow_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workflow_version_id uuid REFERENCES comfyui_deploy.workflow_versions(id) ON DELETE set null, workflow_inputs jsonb, workflow_id uuid NOT NULL REFERENCES comfyui_deploy.workflows(id) ON DELETE cascade, machine_id uuid REFERENCES comfyui_deploy.machines(id) ON DELETE set null, origin workflow_run_origin DEFAULT 'api' NOT NULL, status workflow_run_status DEFAULT 'not-started' NOT NULL, ended_at timestamp, created_at timestamp DEFAULT now() NOT NULL, started_at timestamp)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.workflow_run_outputs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES comfyui_deploy.workflow_runs(id) ON DELETE cascade, data jsonb, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.deployments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES comfyui_deploy.users(id) ON DELETE cascade, org_id text, workflow_version_id uuid NOT NULL REFERENCES comfyui_deploy.workflow_versions(id), workflow_id uuid NOT NULL REFERENCES comfyui_deploy.workflows(id) ON DELETE cascade, machine_id uuid NOT NULL REFERENCES comfyui_deploy.machines(id), share_slug text UNIQUE, description text, showcase_media jsonb, environment deployment_environment NOT NULL, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.api_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, name text NOT NULL, user_id text NOT NULL REFERENCES comfyui_deploy.users(id) ON DELETE cascade, org_id text, revoked boolean DEFAULT false NOT NULL, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS comfyui_deploy.auth_requests (request_id text PRIMARY KEY, user_id text, org_id text, api_hash text, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL, expired_date timestamp)`,
		`ALTER TABLE comfyui_deploy.workflow_versions ADD COLUMN IF NOT EXISTS snapshot jsonb`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS type machine_type DEFAULT 'classic' NOT NULL`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS status machine_status DEFAULT 'ready' NOT NULL`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS snapshot jsonb`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS models jsonb`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS gpu machine_gpu`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS build_machine_instance_id text`,
		`ALTER TABLE comfyui_deploy.machines ADD COLUMN IF NOT EXISTS build_log text`,
		`ALTER TABLE comfyui_deploy.deployments ADD COLUMN IF NOT EXISTS share_slug text UNIQUE`,
		`ALTER TABLE comfyui_deploy.deployments ADD COLUMN IF NOT EXISTS description text`,
		`ALTER TABLE comfyui_deploy.deployments ADD COLUMN IF NOT EXISTS showcase_media jsonb`,
	}
	for _, statement := range statements {
		if _, err := s.DB.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) EnsureLocalUser(ctx context.Context, id, name string) error {
	username := id
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO comfyui_deploy.users (id, username, name)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name, updated_at = now()
	`, id, username, name)
	if err == sql.ErrNoRows {
		return nil
	}
	return err
}
