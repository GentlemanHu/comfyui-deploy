export type WorkflowItem = {
  id: string;
  name: string;
  user_id: string;
  org_id?: string | null;
  created_at: string;
  updated_at: string;
  user?: { name: string };
  versions?: WorkflowVersion[];
  deployments?: Deployment[];
};

export type WorkflowVersion = {
  workflow_id: string;
  id: string;
  workflow: unknown;
  workflow_api: unknown;
  snapshot: unknown;
  version: number;
  created_at: string;
  updated_at: string;
};

export type Machine = {
  id: string;
  user_id: string;
  org_id?: string | null;
  name: string;
  endpoint: string;
  auth_token?: string;
  type: string;
  status: string;
  disabled: boolean;
  snapshot?: unknown;
  models?: unknown;
  gpu?: string;
  build_machine_instance_id?: string;
  build_log?: string;
  created_at: string;
  updated_at: string;
};

export type APIKey = {
  id: string;
  name: string;
  key?: string;
  masked_key?: string;
  revoked: boolean;
  created_at: string;
  updated_at: string;
  endpoint?: string;
  date?: string;
};

export type Deployment = {
  id: string;
  user_id: string;
  org_id?: string | null;
  workflow_id: string;
  workflow_version_id: string;
  machine_id: string;
  environment: string;
  share_slug?: string | null;
  description?: string | null;
  showcase_media?: unknown;
  created_at: string;
  updated_at: string;
  machine_name?: string;
  version?: number;
  duration?: number;
  cold_start_duration?: number;
  run_duration?: number;
};

export type Run = {
  id: string;
  workflow_id: string;
  workflow_version_id?: string | null;
  machine_id?: string | null;
  origin: string;
  status: string;
  workflow_inputs: unknown;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  machine_name?: string;
  version?: number;
};

export type RunOutput = {
  id: string;
  run_id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
};

export type WorkflowStats = {
  overview: {
    total_runs: number;
    success_runs: number;
    failed_runs: number;
    active_runs: number;
    total_outputs: number;
    success_rate: number;
    avg_queue_seconds?: number;
    avg_run_seconds?: number;
    latest_run_at?: string;
  };
  status: WorkflowStatsBucket[];
  origins: WorkflowStatsBucket[];
  machines: WorkflowStatsBucket[];
  versions: WorkflowStatsBucket[];
  daily: { date: string; total: number; success: number; failed: number; active: number }[];
  deployments: {
    id: string;
    environment: string;
    version?: number;
    machine_name?: string;
    updated_at: string;
    runs: number;
    success_runs: number;
    success_rate: number;
    last_run_at?: string;
  }[];
  generated_at: string;
};

export type GlobalStats = WorkflowStats & {
  workflows: WorkflowStatsBucket[];
};

export type WorkflowStatsBucket = {
  key: string;
  label: string;
  count: number;
  percentage: number;
  avg_seconds?: number;
};

export type Session = { user_id: string; org_id: string; name: string };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function usePath() {
  return window.location.pathname;
}

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
