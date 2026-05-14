package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type runRecord struct {
	ID                string          `json:"id"`
	WorkflowID        string          `json:"workflow_id"`
	WorkflowVersionID *string         `json:"workflow_version_id"`
	MachineID         *string         `json:"machine_id"`
	Origin            string          `json:"origin"`
	Status            string          `json:"status"`
	WorkflowInputs    json.RawMessage `json:"workflow_inputs"`
	CreatedAt         time.Time       `json:"created_at"`
	StartedAt         *time.Time      `json:"started_at"`
	EndedAt           *time.Time      `json:"ended_at"`
	MachineName       *string         `json:"machine_name,omitempty"`
	Version           *int            `json:"version,omitempty"`
}

type runOutputRecord struct {
	ID        string          `json:"id"`
	RunID     string          `json:"run_id"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func (s *Server) listRuns(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "workflow not found"})
		return
	}
	limit := clampInt(queryInt(r, "limit", 50), 1, 200)
	offset := maxInt(queryInt(r, "offset", 0), 0)
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.workflow_id = $1
		ORDER BY wr.created_at DESC
		LIMIT $2 OFFSET $3
	`, workflowID, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()
	items := make([]runRecord, 0)
	for rows.Next() {
		item, err := scanRun(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) getRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.id = $1
	`, runID)
	item, err := scanRun(row)
	if notFoundOrInternal(w, err, "run not found") {
		return
	}
	if err := s.ensureWorkflowOwner(r, item.WorkflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) getRunOutputs(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	run, err := s.fetchRunForOwner(r, runID)
	if notFoundOrInternal(w, err, "run not found") {
		return
	}
	if err := s.ensureWorkflowOwner(r, run.WorkflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "run not found"})
		return
	}
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT id, run_id, COALESCE(data, 'null'::jsonb), created_at, updated_at
		FROM comfyui_deploy.workflow_run_outputs
		WHERE run_id = $1
		ORDER BY created_at ASC
	`, runID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	defer rows.Close()
	items := make([]runOutputRecord, 0)
	for rows.Next() {
		var item runOutputRecord
		if err := rows.Scan(&item.ID, &item.RunID, &item.Data, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
			return
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) fetchRunForOwner(r *http.Request, runID string) (runRecord, error) {
	row := s.store.DB.QueryRowContext(r.Context(), `
		SELECT wr.id, wr.workflow_id, wr.workflow_version_id, wr.machine_id, wr.origin::text, wr.status::text,
		       COALESCE(wr.workflow_inputs, '{}'::jsonb), wr.created_at, wr.started_at, wr.ended_at,
		       m.name, wv.version
		FROM comfyui_deploy.workflow_runs wr
		LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
		WHERE wr.id = $1
	`, runID)
	return scanRun(row)
}

func scanRun(row rowScanner) (runRecord, error) {
	var item runRecord
	var workflowVersionID sql.NullString
	var machineID sql.NullString
	var startedAt sql.NullTime
	var endedAt sql.NullTime
	var machineName sql.NullString
	var version sql.NullInt64
	err := row.Scan(
		&item.ID, &item.WorkflowID, &workflowVersionID, &machineID, &item.Origin, &item.Status,
		&item.WorkflowInputs, &item.CreatedAt, &startedAt, &endedAt, &machineName, &version,
	)
	item.WorkflowVersionID = ptrNullString(workflowVersionID)
	item.MachineID = ptrNullString(machineID)
	if startedAt.Valid {
		item.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		item.EndedAt = &endedAt.Time
	}
	item.MachineName = ptrNullString(machineName)
	if version.Valid {
		v := int(version.Int64)
		item.Version = &v
	}
	return item, err
}
