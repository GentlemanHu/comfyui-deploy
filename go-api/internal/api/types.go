package api

import (
	"encoding/json"
	"time"
)

type workflow struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	OrgID     *string   `json:"org_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type workflowVersion struct {
	WorkflowID  string          `json:"workflow_id"`
	ID          string          `json:"id"`
	Workflow    json.RawMessage `json:"workflow"`
	WorkflowAPI json.RawMessage `json:"workflow_api"`
	Snapshot    json.RawMessage `json:"snapshot"`
	Version     int             `json:"version"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type machine struct {
	ID        string
	UserID    string
	OrgID     *string
	Name      string
	Endpoint  string
	AuthToken *string
	Type      string
	Disabled  bool
}

type deployment struct {
	ID                string
	UserID            string
	OrgID             *string
	WorkflowVersionID string
	WorkflowID        string
	MachineID         string
	Version           workflowVersion
	Machine           machine
}

type apiError struct {
	Error string `json:"error"`
}
