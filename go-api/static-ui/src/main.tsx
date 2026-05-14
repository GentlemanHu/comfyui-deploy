import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Boxes,
  Copy,
  KeyRound,
  Loader2,
  MonitorCog,
  Play,
  Plus,
  RefreshCcw,
  Server,
  Trash2,
  Workflow
} from "lucide-react";
import { AuthRequest } from "./authRequest";
import { DocsPage } from "./docsPage";
import { MachineDetail } from "./machineDetail";
import { SharePage } from "./sharePage";
import { WorkflowDetail } from "./workflowDetail";
import "./styles.css";

type Session = { user_id: string; org_id: string; name: string };
type WorkflowItem = { id: string; name: string; updated_at: string; created_at: string };
type Machine = {
  id: string;
  name: string;
  endpoint: string;
  type: string;
  status: string;
  disabled: boolean;
  updated_at: string;
};
type APIKey = { id: string; name: string; key?: string; revoked: boolean; created_at: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [path]);
  return { data, error, loading, reload: load };
}

function App() {
  const grantMatch = window.location.pathname.match(/^\/auth(?:-request|\/request)\/([^/]+)$/);
  if (grantMatch) {
    return <AuthRequest requestID={decodeURIComponent(grantMatch[1])} />;
  }
  const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)$/);
  if (shareMatch) {
    return <SharePage shareID={decodeURIComponent(shareMatch[1])} />;
  }
  const workflowMatch = window.location.pathname.match(/^\/workflows\/([^/]+)$/);
  if (workflowMatch) {
    return <WorkflowDetail workflowID={decodeURIComponent(workflowMatch[1])} onBack={() => navigateTo("/")} />;
  }
  const machineMatch = window.location.pathname.match(/^\/machines\/([^/]+)$/);
  if (machineMatch) {
    return <MachineDetail machineID={decodeURIComponent(machineMatch[1])} onBack={() => navigateTo("/")} />;
  }
  if (["/examples", "/docs/install", "/docs/endpoints"].includes(window.location.pathname)) {
    return <DocsPage path={window.location.pathname} />;
  }
  const [tab, setTab] = useState<"workflows" | "machines" | "keys">(initialTab());
  const [workflowID, setWorkflowID] = useState("");
  const [machineID, setMachineID] = useState("");
  const session = useResource<Session>("/api/session");
  if (workflowID) {
    return <WorkflowDetail workflowID={workflowID} onBack={() => setWorkflowID("")} />;
  }
  if (machineID) {
    return <MachineDetail machineID={machineID} onBack={() => setMachineID("")} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark"><Boxes size={20} /></div>
          <div>
            <strong>ComfyDeploy</strong>
            <span>Go runtime</span>
          </div>
        </div>
        <nav>
          <button className={tab === "workflows" ? "active" : ""} onClick={() => setTab("workflows")}>
            <Workflow size={18} /> Workflows
          </button>
          <button className={tab === "machines" ? "active" : ""} onClick={() => setTab("machines")}>
            <Server size={18} /> Machines
          </button>
          <button className={tab === "keys" ? "active" : ""} onClick={() => setTab("keys")}>
            <KeyRound size={18} /> API Keys
          </button>
        </nav>
        <div className="sidebarFooter">
          <span>Signed in</span>
          <strong>{session.data?.name || session.data?.user_id || "Local"}</strong>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{tab === "workflows" ? "Workflows" : tab === "machines" ? "Machines" : "API Keys"}</h1>
            <p>本地 Go 后端控制台，运行时不依赖 Node。</p>
          </div>
          <div className="statusPill">
            <Activity size={16} /> Local
          </div>
        </header>

        {tab === "workflows" && <Workflows onOpen={setWorkflowID} />}
        {tab === "machines" && <Machines onOpen={setMachineID} />}
        {tab === "keys" && <APIKeys />}
      </main>
    </div>
  );
}

function Workflows({ onOpen }: { onOpen: (id: string) => void }) {
  const workflows = useResource<WorkflowItem[]>("/api/workflows?limit=100");
  return (
    <section className="panel">
      <PanelTitle icon={<Workflow size={18} />} title="Your Workflows" onRefresh={workflows.reload} loading={workflows.loading} />
      <ErrorLine error={workflows.error} />
      <div className="table">
        <div className="row head"><span>Name</span><span>ID</span><span>Updated</span></div>
        {(workflows.data ?? []).map((item) => (
          <button className="row rowButton" key={item.id} onClick={() => onOpen(item.id)}>
            <span className="strong">{item.name}</span>
            <code>{item.id}</code>
            <span>{formatDate(item.updated_at)}</span>
          </button>
        ))}
      </div>
      {!workflows.loading && workflows.data?.length === 0 && <Empty text="还没有 workflow。请在 ComfyUI 插件里 Deploy 上传。" />}
    </section>
  );
}

function Machines({ onOpen }: { onOpen: (id: string) => void }) {
  const machines = useResource<Machine[]>("/api/machines");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", endpoint: "", auth_token: "" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api<Machine>("/api/machines", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          endpoint: form.endpoint,
          auth_token: form.auth_token || undefined,
          type: "classic",
          status: "ready"
        })
      });
      setForm({ name: "", endpoint: "", auth_token: "" });
      await machines.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid2">
      <div className="panel">
        <PanelTitle icon={<Server size={18} />} title="Machines" onRefresh={machines.reload} loading={machines.loading} />
        <ErrorLine error={machines.error} />
        <div className="table">
          <div className="row head"><span>Name</span><span>Endpoint</span><span>Status</span><span></span></div>
          {(machines.data ?? []).map((item) => (
            <div className="row four rowButton" key={item.id} onClick={() => onOpen(item.id)}>
              <span className="strong">{item.name}</span>
              <code>{item.endpoint}</code>
              <span className="badge">{item.status}</span>
              <button className="iconButton danger" onClick={(event) => { event.stopPropagation(); void removeMachine(item.id, machines.reload); }} title="Disable machine">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {!machines.loading && machines.data?.length === 0 && <Empty text="还没有 machine。添加你的 ComfyUI 反代地址即可。" />}
      </div>
      <form className="panel formPanel" onSubmit={submit}>
        <PanelTitle icon={<MonitorCog size={18} />} title="Add Machine" />
        <ErrorLine error={error} />
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Endpoint<input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://comfy.example.com" required /></label>
        <label>Basic/Bearer token<input value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} type="password" /></label>
        <button className="primary" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Add machine</button>
      </form>
    </section>
  );
}

async function removeMachine(id: string, reload: () => Promise<void>) {
  await api(`/api/machines/${id}`, { method: "DELETE" });
  await reload();
}

function APIKeys() {
  const keys = useResource<APIKey[]>("/api/api-keys");
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const [error, setError] = useState("");
  const activeCount = useMemo(() => (keys.data ?? []).filter((x) => !x.revoked).length, [keys.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setCreated("");
    setError("");
    try {
      const item = await api<APIKey>("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) });
      setCreated(item.key ?? "");
      setName("");
      await keys.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="grid2">
      <div className="panel">
        <PanelTitle icon={<KeyRound size={18} />} title={`API Keys (${activeCount})`} onRefresh={keys.reload} loading={keys.loading} />
        <ErrorLine error={keys.error} />
        <div className="table">
          <div className="row head"><span>Name</span><span>Status</span><span>Created</span><span></span></div>
          {(keys.data ?? []).map((item) => (
            <div className="row four" key={item.id}>
              <span className="strong">{item.name}</span>
              <span className={item.revoked ? "badge muted" : "badge"}>{item.revoked ? "revoked" : "active"}</span>
              <span>{formatDate(item.created_at)}</span>
              {!item.revoked && <button className="iconButton danger" onClick={() => revokeKey(item.id, keys.reload)} title="Revoke key"><Trash2 size={16} /></button>}
            </div>
          ))}
        </div>
      </div>
      <form className="panel formPanel" onSubmit={submit}>
        <PanelTitle icon={<Plus size={18} />} title="Create API Key" />
        <ErrorLine error={error} />
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <button className="primary"><KeyRound size={16} /> Create key</button>
        {created && (
          <div className="secretBox">
            <button type="button" className="iconButton" onClick={() => navigator.clipboard.writeText(created)} title="Copy">
              <Copy size={16} />
            </button>
            <code>{created}</code>
          </div>
        )}
      </form>
    </section>
  );
}

async function revokeKey(id: string, reload: () => Promise<void>) {
  await api(`/api/api-keys/${id}`, { method: "DELETE" });
  await reload();
}

function PanelTitle(props: { icon: React.ReactNode; title: string; onRefresh?: () => Promise<void>; loading?: boolean }) {
  return (
    <div className="panelTitle">
      <h2>{props.icon}{props.title}</h2>
      {props.onRefresh && (
        <button className="iconButton" onClick={() => void props.onRefresh?.()} title="Refresh">
          {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
        </button>
      )}
    </div>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><Play size={18} />{text}</div>;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

createRoot(document.getElementById("root")!).render(<App />);

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.location.reload();
}

function initialTab(): "workflows" | "machines" | "keys" {
  if (window.location.pathname === "/machines") return "machines";
  if (window.location.pathname === "/api-keys") return "keys";
  return "workflows";
}
