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
  build_log?: string;
  created_at: string;
  updated_at: string;
};

export type APIKey = {
  id: string;
  name: string;
  key?: string;
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
