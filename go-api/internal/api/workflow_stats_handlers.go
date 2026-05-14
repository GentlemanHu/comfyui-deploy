package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type workflowStatsResponse struct {
	Overview    workflowStatsOverview      `json:"overview"`
	Status      []workflowStatsBucket      `json:"status"`
	Origins     []workflowStatsBucket      `json:"origins"`
	Machines    []workflowStatsBucket      `json:"machines"`
	Versions    []workflowStatsBucket      `json:"versions"`
	Daily       []workflowStatsDailyBucket `json:"daily"`
	Deployments []workflowStatsDeployment  `json:"deployments"`
	GeneratedAt time.Time                  `json:"generated_at"`
}

type globalStatsResponse struct {
	Overview    workflowStatsOverview      `json:"overview"`
	Workflows   []workflowStatsBucket      `json:"workflows"`
	Status      []workflowStatsBucket      `json:"status"`
	Origins     []workflowStatsBucket      `json:"origins"`
	Machines    []workflowStatsBucket      `json:"machines"`
	Versions    []workflowStatsBucket      `json:"versions"`
	Daily       []workflowStatsDailyBucket `json:"daily"`
	Deployments []workflowStatsDeployment  `json:"deployments"`
	GeneratedAt time.Time                  `json:"generated_at"`
}

type workflowStatsOverview struct {
	TotalRuns       int        `json:"total_runs"`
	SuccessRuns     int        `json:"success_runs"`
	FailedRuns      int        `json:"failed_runs"`
	ActiveRuns      int        `json:"active_runs"`
	TotalOutputs    int        `json:"total_outputs"`
	SuccessRate     float64    `json:"success_rate"`
	AvgQueueSeconds *float64   `json:"avg_queue_seconds,omitempty"`
	AvgRunSeconds   *float64   `json:"avg_run_seconds,omitempty"`
	LatestRunAt     *time.Time `json:"latest_run_at,omitempty"`
}

type workflowStatsBucket struct {
	Key        string   `json:"key"`
	Label      string   `json:"label"`
	Count      int      `json:"count"`
	Percentage float64  `json:"percentage"`
	AvgSeconds *float64 `json:"avg_seconds,omitempty"`
}

type workflowStatsDailyBucket struct {
	Date    string `json:"date"`
	Total   int    `json:"total"`
	Success int    `json:"success"`
	Failed  int    `json:"failed"`
	Active  int    `json:"active"`
}

type workflowStatsDeployment struct {
	ID          string     `json:"id"`
	Environment string     `json:"environment"`
	Version     *int       `json:"version,omitempty"`
	MachineName *string    `json:"machine_name,omitempty"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Runs        int        `json:"runs"`
	SuccessRuns int        `json:"success_runs"`
	SuccessRate float64    `json:"success_rate"`
	LastRunAt   *time.Time `json:"last_run_at,omitempty"`
}

func (s *Server) workflowStats(w http.ResponseWriter, r *http.Request) {
	workflowID := chi.URLParam(r, "workflow_id")
	if err := s.ensureWorkflowOwner(r, workflowID); err != nil {
		writeJSON(w, http.StatusNotFound, apiError{Error: "workflow not found"})
		return
	}
	overview, err := s.fetchWorkflowStatsOverview(r, workflowID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	status, err := s.fetchStatsBuckets(r, workflowID, "status")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	origins, err := s.fetchStatsBuckets(r, workflowID, "origin")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	machines, err := s.fetchStatsBuckets(r, workflowID, "machine")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	versions, err := s.fetchStatsBuckets(r, workflowID, "version")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	daily, err := s.fetchDailyStats(r, workflowID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	deployments, err := s.fetchDeploymentStats(r, workflowID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, workflowStatsResponse{
		Overview: overview, Status: status, Origins: origins, Machines: machines, Versions: versions,
		Daily: daily, Deployments: deployments, GeneratedAt: time.Now(),
	})
}

func (s *Server) globalStats(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	overview, err := s.fetchGlobalStatsOverview(r, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	workflows, err := s.fetchGlobalStatsBuckets(r, user.OrgID, user.UserID, "workflow")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	status, err := s.fetchGlobalStatsBuckets(r, user.OrgID, user.UserID, "status")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	origins, err := s.fetchGlobalStatsBuckets(r, user.OrgID, user.UserID, "origin")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	machines, err := s.fetchGlobalStatsBuckets(r, user.OrgID, user.UserID, "machine")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	versions, err := s.fetchGlobalStatsBuckets(r, user.OrgID, user.UserID, "version")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	daily, err := s.fetchGlobalDailyStats(r, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	deployments, err := s.fetchGlobalDeploymentStats(r, user.OrgID, user.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError{Error: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, globalStatsResponse{
		Overview: overview, Workflows: workflows, Status: status, Origins: origins, Machines: machines, Versions: versions,
		Daily: daily, Deployments: deployments, GeneratedAt: time.Now(),
	})
}

func (s *Server) fetchWorkflowStatsOverview(r *http.Request, workflowID string) (workflowStatsOverview, error) {
	var item workflowStatsOverview
	var avgQueue sql.NullFloat64
	var avgRun sql.NullFloat64
	var latest sql.NullTime
	err := s.store.DB.QueryRowContext(r.Context(), `
		WITH run_base AS (
			SELECT *
			FROM comfyui_deploy.workflow_runs
			WHERE workflow_id = $1
		), output_base AS (
			SELECT COUNT(*)::int AS total_outputs
			FROM comfyui_deploy.workflow_run_outputs o
			JOIN run_base rb ON rb.id = o.run_id
		)
		SELECT COUNT(*)::int,
		       COUNT(*) FILTER (WHERE status = 'success')::int,
		       COUNT(*) FILTER (WHERE status = 'failed')::int,
		       COUNT(*) FILTER (WHERE status IN ('not-started','running','uploading'))::int,
		       (SELECT total_outputs FROM output_base),
		       AVG(EXTRACT(EPOCH FROM (started_at - created_at))) FILTER (WHERE started_at IS NOT NULL),
		       AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) FILTER (WHERE started_at IS NOT NULL AND ended_at IS NOT NULL),
		       MAX(created_at)
		FROM run_base
	`, workflowID).Scan(&item.TotalRuns, &item.SuccessRuns, &item.FailedRuns, &item.ActiveRuns, &item.TotalOutputs, &avgQueue, &avgRun, &latest)
	if err != nil {
		return item, err
	}
	if item.TotalRuns > 0 {
		item.SuccessRate = roundPercent(float64(item.SuccessRuns) * 100 / float64(item.TotalRuns))
	}
	item.AvgQueueSeconds = ptrNullFloat(avgQueue)
	item.AvgRunSeconds = ptrNullFloat(avgRun)
	if latest.Valid {
		item.LatestRunAt = &latest.Time
	}
	return item, nil
}

func (s *Server) fetchGlobalStatsOverview(r *http.Request, orgID string, userID string) (workflowStatsOverview, error) {
	var item workflowStatsOverview
	var avgQueue sql.NullFloat64
	var avgRun sql.NullFloat64
	var latest sql.NullTime
	err := s.store.DB.QueryRowContext(r.Context(), `
		WITH run_base AS (
			SELECT wr.*
			FROM comfyui_deploy.workflow_runs wr
			JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
		), output_base AS (
			SELECT COUNT(*)::int AS total_outputs
			FROM comfyui_deploy.workflow_run_outputs o
			JOIN run_base rb ON rb.id = o.run_id
		)
		SELECT COUNT(*)::int,
		       COUNT(*) FILTER (WHERE status = 'success')::int,
		       COUNT(*) FILTER (WHERE status = 'failed')::int,
		       COUNT(*) FILTER (WHERE status IN ('not-started','running','uploading'))::int,
		       (SELECT total_outputs FROM output_base),
		       AVG(EXTRACT(EPOCH FROM (started_at - created_at))) FILTER (WHERE started_at IS NOT NULL),
		       AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) FILTER (WHERE started_at IS NOT NULL AND ended_at IS NOT NULL),
		       MAX(created_at)
		FROM run_base
	`, orgID, userID).Scan(&item.TotalRuns, &item.SuccessRuns, &item.FailedRuns, &item.ActiveRuns, &item.TotalOutputs, &avgQueue, &avgRun, &latest)
	if err != nil {
		return item, err
	}
	if item.TotalRuns > 0 {
		item.SuccessRate = roundPercent(float64(item.SuccessRuns) * 100 / float64(item.TotalRuns))
	}
	item.AvgQueueSeconds = ptrNullFloat(avgQueue)
	item.AvgRunSeconds = ptrNullFloat(avgRun)
	if latest.Valid {
		item.LatestRunAt = &latest.Time
	}
	return item, nil
}

func (s *Server) fetchStatsBuckets(r *http.Request, workflowID string, kind string) ([]workflowStatsBucket, error) {
	query := map[string]string{
		"status": `SELECT wr.status::text, wr.status::text, COUNT(*)::int, NULL::double precision
			FROM comfyui_deploy.workflow_runs wr WHERE wr.workflow_id = $1 GROUP BY wr.status ORDER BY COUNT(*) DESC`,
		"origin": `SELECT wr.origin::text, wr.origin::text, COUNT(*)::int, NULL::double precision
			FROM comfyui_deploy.workflow_runs wr WHERE wr.workflow_id = $1 GROUP BY wr.origin ORDER BY COUNT(*) DESC`,
		"machine": `SELECT COALESCE(wr.machine_id::text, 'unknown'), COALESCE(m.name, 'Unknown machine'), COUNT(*)::int,
			       AVG(EXTRACT(EPOCH FROM (wr.ended_at - wr.started_at))) FILTER (WHERE wr.started_at IS NOT NULL AND wr.ended_at IS NOT NULL)
			FROM comfyui_deploy.workflow_runs wr LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
			WHERE wr.workflow_id = $1 GROUP BY wr.machine_id, m.name ORDER BY COUNT(*) DESC, COALESCE(m.name, 'Unknown machine') ASC`,
		"version": `SELECT COALESCE(wv.version::text, 'unknown'), CASE WHEN wv.version IS NULL THEN 'Unknown version' ELSE 'v' || wv.version::text END, COUNT(*)::int,
			       AVG(EXTRACT(EPOCH FROM (wr.ended_at - wr.started_at))) FILTER (WHERE wr.started_at IS NOT NULL AND wr.ended_at IS NOT NULL)
			FROM comfyui_deploy.workflow_runs wr LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
			WHERE wr.workflow_id = $1 GROUP BY wv.version ORDER BY COUNT(*) DESC, wv.version DESC`,
	}[kind]
	rows, err := s.store.DB.QueryContext(r.Context(), query, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsBucket, 0)
	total := 0
	for rows.Next() {
		var item workflowStatsBucket
		var avg sql.NullFloat64
		if err := rows.Scan(&item.Key, &item.Label, &item.Count, &avg); err != nil {
			return nil, err
		}
		item.AvgSeconds = ptrNullFloat(avg)
		total += item.Count
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range items {
		if total > 0 {
			items[i].Percentage = roundPercent(float64(items[i].Count) * 100 / float64(total))
		}
	}
	return items, nil
}

func (s *Server) fetchGlobalStatsBuckets(r *http.Request, orgID string, userID string, kind string) ([]workflowStatsBucket, error) {
	query := map[string]string{
		"workflow": `SELECT w.id::text, w.name, COUNT(*)::int,
			       AVG(EXTRACT(EPOCH FROM (wr.ended_at - wr.started_at))) FILTER (WHERE wr.started_at IS NOT NULL AND wr.ended_at IS NOT NULL)
			FROM comfyui_deploy.workflow_runs wr JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
			GROUP BY w.id, w.name ORDER BY COUNT(*) DESC, w.updated_at DESC LIMIT 12`,
		"status": `SELECT wr.status::text, wr.status::text, COUNT(*)::int, NULL::double precision
			FROM comfyui_deploy.workflow_runs wr JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
			GROUP BY wr.status ORDER BY COUNT(*) DESC`,
		"origin": `SELECT wr.origin::text, wr.origin::text, COUNT(*)::int, NULL::double precision
			FROM comfyui_deploy.workflow_runs wr JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
			GROUP BY wr.origin ORDER BY COUNT(*) DESC`,
		"machine": `SELECT COALESCE(wr.machine_id::text, 'unknown'), COALESCE(m.name, 'Unknown machine'), COUNT(*)::int,
			       AVG(EXTRACT(EPOCH FROM (wr.ended_at - wr.started_at))) FILTER (WHERE wr.started_at IS NOT NULL AND wr.ended_at IS NOT NULL)
			FROM comfyui_deploy.workflow_runs wr JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			LEFT JOIN comfyui_deploy.machines m ON m.id = wr.machine_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
			GROUP BY wr.machine_id, m.name ORDER BY COUNT(*) DESC, COALESCE(m.name, 'Unknown machine') ASC LIMIT 12`,
		"version": `SELECT COALESCE(wr.workflow_id::text || ':' || wv.version::text, 'unknown'), COALESCE(w.name || ' v' || wv.version::text, 'Unknown version'), COUNT(*)::int,
			       AVG(EXTRACT(EPOCH FROM (wr.ended_at - wr.started_at))) FILTER (WHERE wr.started_at IS NOT NULL AND wr.ended_at IS NOT NULL)
			FROM comfyui_deploy.workflow_runs wr JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
			LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = wr.workflow_version_id
			WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
			GROUP BY wr.workflow_id, w.name, wv.version ORDER BY COUNT(*) DESC, w.name ASC LIMIT 12`,
	}[kind]
	rows, err := s.store.DB.QueryContext(r.Context(), query, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsBucket, 0)
	total := 0
	for rows.Next() {
		var item workflowStatsBucket
		var avg sql.NullFloat64
		if err := rows.Scan(&item.Key, &item.Label, &item.Count, &avg); err != nil {
			return nil, err
		}
		item.AvgSeconds = ptrNullFloat(avg)
		total += item.Count
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range items {
		if total > 0 {
			items[i].Percentage = roundPercent(float64(items[i].Count) * 100 / float64(total))
		}
	}
	return items, nil
}

func (s *Server) fetchDailyStats(r *http.Request, workflowID string) ([]workflowStatsDailyBucket, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT to_char(day::date, 'YYYY-MM-DD'),
		       COUNT(wr.id)::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'success')::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'failed')::int,
		       COUNT(wr.id) FILTER (WHERE wr.status IN ('not-started','running','uploading'))::int
		FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') day
		LEFT JOIN comfyui_deploy.workflow_runs wr ON wr.workflow_id = $1 AND wr.created_at::date = day::date
		GROUP BY day ORDER BY day ASC
	`, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsDailyBucket, 0, 14)
	for rows.Next() {
		var item workflowStatsDailyBucket
		if err := rows.Scan(&item.Date, &item.Total, &item.Success, &item.Failed, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) fetchGlobalDailyStats(r *http.Request, orgID string, userID string) ([]workflowStatsDailyBucket, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT to_char(day::date, 'YYYY-MM-DD'),
		       COUNT(wr.id)::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'success')::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'failed')::int,
		       COUNT(wr.id) FILTER (WHERE wr.status IN ('not-started','running','uploading'))::int
		FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') day
		LEFT JOIN comfyui_deploy.workflow_runs wr ON wr.created_at::date = day::date
		LEFT JOIN comfyui_deploy.workflows w ON w.id = wr.workflow_id
		WHERE wr.id IS NULL OR (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
		GROUP BY day ORDER BY day ASC
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsDailyBucket, 0, 30)
	for rows.Next() {
		var item workflowStatsDailyBucket
		if err := rows.Scan(&item.Date, &item.Total, &item.Success, &item.Failed, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) fetchDeploymentStats(r *http.Request, workflowID string) ([]workflowStatsDeployment, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT d.id, d.environment::text, wv.version, m.name, d.updated_at,
		       COUNT(wr.id)::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'success')::int,
		       MAX(wr.created_at)
		FROM comfyui_deploy.deployments d
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = d.workflow_version_id
		LEFT JOIN comfyui_deploy.machines m ON m.id = d.machine_id
		LEFT JOIN comfyui_deploy.workflow_runs wr
		  ON wr.workflow_id = d.workflow_id
		 AND wr.workflow_version_id = d.workflow_version_id
		 AND wr.machine_id = d.machine_id
		WHERE d.workflow_id = $1
		GROUP BY d.id, d.environment, wv.version, m.name, d.updated_at
		ORDER BY d.environment ASC
	`, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsDeployment, 0)
	for rows.Next() {
		var item workflowStatsDeployment
		var version sql.NullInt64
		var machine sql.NullString
		var lastRun sql.NullTime
		if err := rows.Scan(&item.ID, &item.Environment, &version, &machine, &item.UpdatedAt, &item.Runs, &item.SuccessRuns, &lastRun); err != nil {
			return nil, err
		}
		if version.Valid {
			v := int(version.Int64)
			item.Version = &v
		}
		item.MachineName = ptrNullString(machine)
		if lastRun.Valid {
			item.LastRunAt = &lastRun.Time
		}
		if item.Runs > 0 {
			item.SuccessRate = roundPercent(float64(item.SuccessRuns) * 100 / float64(item.Runs))
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) fetchGlobalDeploymentStats(r *http.Request, orgID string, userID string) ([]workflowStatsDeployment, error) {
	rows, err := s.store.DB.QueryContext(r.Context(), `
		SELECT d.id, d.environment::text, wv.version, COALESCE(w.name || ' · ' || m.name, m.name), d.updated_at,
		       COUNT(wr.id)::int,
		       COUNT(wr.id) FILTER (WHERE wr.status = 'success')::int,
		       MAX(wr.created_at)
		FROM comfyui_deploy.deployments d
		JOIN comfyui_deploy.workflows w ON w.id = d.workflow_id
		LEFT JOIN comfyui_deploy.workflow_versions wv ON wv.id = d.workflow_version_id
		LEFT JOIN comfyui_deploy.machines m ON m.id = d.machine_id
		LEFT JOIN comfyui_deploy.workflow_runs wr
		  ON wr.workflow_id = d.workflow_id
		 AND wr.workflow_version_id = d.workflow_version_id
		 AND wr.machine_id = d.machine_id
		WHERE (($1::text <> '' AND w.org_id = $1) OR ($1::text = '' AND w.user_id = $2 AND w.org_id IS NULL))
		GROUP BY d.id, d.environment, wv.version, w.name, m.name, d.updated_at
		ORDER BY COUNT(wr.id) DESC, d.updated_at DESC
		LIMIT 16
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]workflowStatsDeployment, 0)
	for rows.Next() {
		var item workflowStatsDeployment
		var version sql.NullInt64
		var machine sql.NullString
		var lastRun sql.NullTime
		if err := rows.Scan(&item.ID, &item.Environment, &version, &machine, &item.UpdatedAt, &item.Runs, &item.SuccessRuns, &lastRun); err != nil {
			return nil, err
		}
		if version.Valid {
			v := int(version.Int64)
			item.Version = &v
		}
		item.MachineName = ptrNullString(machine)
		if lastRun.Valid {
			item.LastRunAt = &lastRun.Time
		}
		if item.Runs > 0 {
			item.SuccessRate = roundPercent(float64(item.SuccessRuns) * 100 / float64(item.Runs))
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func ptrNullFloat(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	rounded := float64(int(value.Float64*100+0.5)) / 100
	return &rounded
}

func roundPercent(value float64) float64 {
	return float64(int(value*10+0.5)) / 10
}
