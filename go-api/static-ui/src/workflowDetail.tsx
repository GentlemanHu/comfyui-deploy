import React, { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Boxes, UploadCloud, Loader2, Play, RefreshCcw, Rocket, Server, Workflow } from "lucide-react";

type WorkflowItem = { id: string; name: string; updated_at: string; versions?: Version[] };
type Version = { id: string; version: number; created_at: string };
type Machine = { id: string; name: string; endpoint: string; status: string };
type Deployment = {
  id: string;
  workflow_version_id: string;
  machine_id: string;
  environment: string;
  share_slug?: string;
  machine_name?: string;
  version?: number;
  updated_at: string;
};
type Run = {
  id: string;
  status: string;
  origin: string;
  version?: number;
  machine_name?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
};
type RunOutput = { id: string; data: unknown; created_at: string };

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

export function WorkflowDetail({ workflowID, onBack }: { workflowID: string; onBack: () => void }) {
  const workflow = useResource<WorkflowItem>(`/api/workflow/${workflowID}`);
  const versions = useResource<Version[]>(`/api/workflow/${workflowID}/versions?limit=50`);
  const deployments = useResource<Deployment[]>(`/api/workflow/${workflowID}/deployments`);
  const runs = useResource<Run[]>(`/api/workflow/${workflowID}/runs?limit=80`);
  const machines = useResource<Machine[]>("/api/machines");

  const reloadAll = async () => {
    await Promise.all([workflow.reload(), versions.reload(), deployments.reload(), runs.reload(), machines.reload()]);
  };

  return (
    <div className="detailApp">
      <header className="detailTopbar">
        <button className="iconButton" onClick={onBack} title="Back"><ArrowLeft size={17} /></button>
        <div>
          <h1>{workflow.data?.name ?? "Workflow"}</h1>
          <p>{workflowID}</p>
        </div>
        <button className="primary compact" onClick={() => void reloadAll()}>
          {workflow.loading ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />} Refresh
        </button>
      </header>

      <ErrorLine error={workflow.error || versions.error || deployments.error || runs.error || machines.error} />

      <section className="grid2 detailGrid">
        <div className="panel">
          <PanelTitle icon={<Rocket size={18} />} title="Deployments" />
          <DeploymentForm workflowID={workflowID} versions={versions.data ?? []} machines={machines.data ?? []} onCreated={deployments.reload} />
          <div className="table">
            <div className="row four head"><span>Environment</span><span>Machine</span><span>Version</span><span></span></div>
            {(deployments.data ?? []).map((item) => (
              <div className="row four" key={item.id}>
                <span className="strong">{item.environment}</span>
                <span>{item.machine_name ?? item.machine_id}</span>
                <span className="badge">v{item.version ?? "-"}</span>
                <button className="iconButton danger" onClick={() => removeDeployment(item.id, deployments.reload)} title="Delete deployment">Del</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelTitle icon={<Boxes size={18} />} title="Versions" />
          <div className="table">
            <div className="row head"><span>Version</span><span>ID</span><span>Created</span></div>
            {(versions.data ?? []).map((item) => (
              <div className="row" key={item.id}>
                <span className="strong">v{item.version}</span>
                <code>{item.id}</code>
                <span>{formatDate(item.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={<Play size={18} />} title="Runs" />
        <div className="table">
          <div className="row runsHead head"><span>Status</span><span>Run ID</span><span>Machine</span><span>Version</span><span>Created</span></div>
          {(runs.data ?? []).map((item) => <RunRow key={item.id} run={item} />)}
        </div>
        {!runs.loading && runs.data?.length === 0 && <div className="empty">还没有运行记录。</div>}
      </section>
    </div>
  );
}

function DeploymentForm(props: { workflowID: string; versions: Version[]; machines: Machine[]; onCreated: () => Promise<void> }) {
  const [versionID, setVersionID] = useState("");
  const [machineID, setMachineID] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!versionID && props.versions[0]) setVersionID(props.versions[0].id);
    if (!machineID && props.machines[0]) setMachineID(props.machines[0].id);
  }, [props.versions, props.machines, versionID, machineID]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/api/workflow/${props.workflowID}/deployments`, {
        method: "POST",
        body: JSON.stringify({ version_id: versionID, machine_id: machineID, environment })
      });
      await props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="inlineForm" onSubmit={submit}>
      <ErrorLine error={error} />
      <select value={versionID} onChange={(e) => setVersionID(e.target.value)} required>
        {props.versions.map((item) => <option key={item.id} value={item.id}>v{item.version}</option>)}
      </select>
      <select value={machineID} onChange={(e) => setMachineID(e.target.value)} required>
        {props.machines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
        <option value="production">production</option>
        <option value="staging">staging</option>
        <option value="public-share">public-share</option>
      </select>
      <button className="primary compact" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />} Deploy</button>
    </form>
  );
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const outputs = useResource<RunOutput[]>(open ? `/api/run/${run.id}/outputs` : "/api/session");
  return (
    <>
      <button className="row rowButton runsHead" onClick={() => setOpen(!open)}>
        <span className={`badge status-${run.status}`}>{run.status}</span>
        <code>{run.id}</code>
        <span>{run.machine_name ?? "-"}</span>
        <span>v{run.version ?? "-"}</span>
        <span>{formatDate(run.created_at)}</span>
      </button>
      {open && (
        <div className="outputBox">
          <pre>{JSON.stringify(outputs.data ?? [], null, 2)}</pre>
        </div>
      )}
    </>
  );
}

async function removeDeployment(id: string, reload: () => Promise<void>) {
  await api(`/api/deployments/${id}`, { method: "DELETE" });
  await reload();
}

function PanelTitle(props: { icon: React.ReactNode; title: string }) {
  return <div className="panelTitle"><h2>{props.icon}{props.title}</h2></div>;
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
