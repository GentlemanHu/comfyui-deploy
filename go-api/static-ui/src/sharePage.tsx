import { KeyRound, Loader2, MoreVertical, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { navigate, type Run } from "./api";
import { MediaPreviewGrid, extractMediaItems } from "./components/MediaPreview";
import { Button } from "./components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { Input } from "./components/ui/input";
import { getInputsFromWorkflow, getDefaultInputValues, type ExternalInputDefinition } from "./lib/externalInputs";
import { getRelativeTime } from "./lib/getRelativeTime";

type ShareData = {
  owner_name?: string;
  workflow_name: string;
  deployment: {
    id: string;
    workflow_id: string;
    workflow_version_id: string;
    workflow_api?: Record<string, any>;
    machine_id: string;
    environment: string;
    share_slug?: string | null;
    description?: string | null;
    showcase_media?: Array<{ url?: string; filename?: string; width?: number; height?: number }> | null;
    updated_at: string;
  };
};

type RunStatus = {
  run_id: string;
  status: string;
  progress?: number;
  current_node?: string | null;
};

type ShareRunOutput = {
  id: string;
  data: unknown;
};

export function SharePage({ shareID }: { shareID: string }) {
  const [shared, setShared] = useState<{ data: ShareData | null; loading: boolean; error: string; accessRequired: boolean }>({ data: null, loading: true, error: "", accessRequired: false });
  const [runState, setRunState] = useState<RunStatus | null>(null);
  const [runOutputs, setRunOutputs] = useState<ShareRunOutput[]>([]);
  const [accessKey, setAccessKey] = useState(() => window.localStorage.getItem(`share-key:${shareID}`) ?? "");
  const [recentRuns, setRecentRuns] = useState<Run[]>(() => readRecentRuns(shareID));

  const loadShare = async (key = accessKey) => {
    setShared((prev) => ({ ...prev, loading: true, error: "" }));
    const response = await fetch(`/api/share/${shareID}`, { headers: shareHeaders(key), credentials: "include" });
    if (response.status === 401) {
      setShared({ data: null, loading: false, error: "", accessRequired: true });
      return;
    }
    if (!response.ok) {
      setShared({ data: null, loading: false, error: await response.text(), accessRequired: false });
      return;
    }
    const data = await response.json() as ShareData;
    setShared({ data, loading: false, error: "", accessRequired: false });
  };

  useEffect(() => {
    void loadShare();
  }, [shareID]);

  useEffect(() => {
    if (!runState?.run_id || runState.status === "success" || runState.status === "failed") return;
    const timer = window.setInterval(async () => {
      void loadRunAndOutputs(runState.run_id);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [runState]);

  const loadRunAndOutputs = async (runID: string) => {
    try {
      const run = await shareApi<Run>(shareID, `/run/${runID}`, accessKey);
      setRunState({ run_id: run.id, status: run.status, progress: run.progress, current_node: run.current_node });
      setRecentRuns((prev) => saveRecentRun(shareID, run, prev));
      const outputs = await shareApi<ShareRunOutput[]>(shareID, `/run/${run.id}/outputs`, accessKey);
      setRunOutputs(outputs);
    } catch (error) {
      toast.error(String(error));
    }
  };

  if (shared.loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (shared.accessRequired) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-white px-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-2xl font-semibold"><KeyRound className="h-5 w-5" />Private share</div>
          <p className="mt-2 text-sm text-muted-foreground">Enter the page key from the owner to open this share.</p>
          <Input className="mt-5" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="Share key" type="password" />
          <Button className="mt-4 w-full" onClick={async () => {
            window.localStorage.setItem(`share-key:${shareID}`, accessKey);
            await loadShare(accessKey);
          }}>Open share</Button>
        </div>
      </div>
    );
  }

  if (shared.error || !shared.data) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-destructive">{shared.error || "Share not found"}</div>;
  }

  const item = shared.data.deployment;
  const inputs = getInputsFromWorkflow(item.workflow_api);
  const title = shared.data.owner_name ? `${shared.data.owner_name} / ${shared.data.workflow_name}` : shared.data.workflow_name;
  const activeRun = runState && !["success", "failed"].includes(runState.status);

  return (
    <div className="mt-4 grid max-h-[calc(100dvh-100px)] w-full grid-rows-[1fr,1fr] gap-4 lg:grid-cols-[minmax(auto,500px),1fr]">
      <div className="mt-4 h-fit w-full rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-2xl font-semibold leading-none tracking-tight">{title}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">Clone <MoreVertical size={14} /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuItem onClick={async () => {
                  const result = await shareApi<{ workflow_id: string; message: string }>(shareID, "/clone-workflow", accessKey, { method: "POST" });
                  toast.success(result.message);
                  navigate(`/workflows/${result.workflow_id}`);
                }}>
                  Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const result = await shareApi<{ machine_id: string; message: string }>(shareID, "/clone-machine", accessKey, { method: "POST" });
                  toast.success(result.message);
                  navigate(`/machines/${result.machine_id}`);
                }}>
                  Machine
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="text-sm text-muted-foreground">{getRelativeTime(item.updated_at)}</div>
        </div>

        <div className="space-y-6 p-6 pt-0">
          {item.description ? <div>{item.description}</div> : null}
          <ShareRunForm
            deploymentID={item.id}
            shareID={shareID}
            accessKey={accessKey}
            inputs={inputs}
            activeRun={Boolean(activeRun)}
            onStarted={(runID) => {
              setRunOutputs([]);
              setRunState({ run_id: runID, status: "preparing" });
            }}
          />
        </div>
      </div>

      <div className="mt-4 h-fit w-full rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="text-sm text-muted-foreground">Run outputs</div>
        </div>
        <div className="p-6 pt-0">
          {runState ? <ShareRunStatus state={runState} /> : null}
          {runOutputs.length > 0 ? (
            <MediaPreviewGrid
              items={runOutputs.flatMap((output) => extractMediaItems(output.data))}
              runID={runState?.run_id}
              emptyText="No preview outputs."
            />
          ) : runState && runState.status !== "success" ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
              <span className="mr-2 capitalize">{runState.status}</span>
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <MediaPreviewGrid
              items={item.showcase_media ?? []}
              emptyText="No preview outputs."
            />
          )}
          {recentRuns.length > 0 ? <RecentShareRuns runs={recentRuns} onOpen={(run) => {
            setRunOutputs([]);
            setRunState({ run_id: run.id, status: run.status, progress: run.progress, current_node: run.current_node });
            void loadRunAndOutputs(run.id);
          }} /> : null}
        </div>
      </div>
    </div>
  );
}

function ShareRunForm({ shareID, accessKey, inputs, activeRun, onStarted }: { deploymentID: string; shareID: string; accessKey: string; inputs: ExternalInputDefinition[]; activeRun: boolean; onStarted: (runID: string) => void }) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => getDefaultInputValues(inputs));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setValues(getDefaultInputValues(inputs));
  }, [inputs]);

  return (
    <div className="space-y-4">
      {inputs.length > 0 ? inputs.map((item) => (
        <div key={item.input_id} className="grid gap-2">
          <div className="text-sm font-medium">{item.display_name || item.input_id}</div>
          {item.value_type === "boolean" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(values[item.input_id])} onChange={(e) => setValues((prev) => ({ ...prev, [item.input_id]: e.target.checked }))} />
              <span>Enabled</span>
            </label>
          ) : item.value_type === "enum" && item.options?.length ? (
            <select className="h-10 rounded-md border bg-background px-3" value={String(values[item.input_id] ?? "")} onChange={(e) => setValues((prev) => ({ ...prev, [item.input_id]: e.target.value }))}>
              {item.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <Input
              type={item.value_type === "number" || item.value_type === "integer" ? "number" : "text"}
              value={String(values[item.input_id] ?? "")}
              onChange={(e) => setValues((prev) => ({
                ...prev,
                [item.input_id]: item.value_type === "number" || item.value_type === "integer"
                  ? (e.target.value === "" ? "" : Number(e.target.value))
                  : e.target.value,
              }))}
            />
          )}
        </div>
      )) : <div className="text-sm text-muted-foreground">No public inputs. Click run to execute directly.</div>}

      <Button
        className="gap-2"
        disabled={running || activeRun}
        onClick={async () => {
          setRunning(true);
          try {
            const result = await shareApi<{ run_id: string }>(shareID, "/run", accessKey, {
              method: "POST",
              body: JSON.stringify({ inputs: Object.keys(values).length > 0 ? values : undefined, run_origin: "public-share" }),
            });
            onStarted(result.run_id);
            toast.success(`Run started: ${result.run_id}`);
          } catch (error) {
            toast.error(String(error));
          } finally {
            setRunning(false);
          }
        }}
      >
        {running || activeRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {activeRun ? "Running" : "Run"}
      </Button>
      {activeRun ? <p className="text-xs text-muted-foreground">A generation is already running on this page. Wait for it to finish before starting another one.</p> : null}
    </div>
  );
}

function ShareRunStatus({ state }: { state: RunStatus }) {
  const progress = normalizeProgress(state.progress, state.status);
  return (
    <div className="mb-4 rounded-lg border bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <div className="font-medium capitalize">{state.status}</div>
          <div className="mt-1 text-xs text-muted-foreground">{state.current_node || state.run_id}</div>
        </div>
        <div className="text-sm font-medium">{Math.round(progress)}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function RecentShareRuns({ runs, onOpen }: { runs: Run[]; onOpen: (run: Run) => void }) {
  return (
    <div className="mt-6 rounded-lg border">
      <div className="border-b px-4 py-3 text-sm font-medium">Recent generations on this device</div>
      <div className="divide-y">
        {runs.slice(0, 6).map((run) => (
          <button key={run.id} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50" onClick={() => onOpen(run)}>
            <span className="truncate font-mono text-xs">{run.id}</span>
            <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs">{run.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

async function shareApi<T>(shareID: string, path: string, accessKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/share/${shareID}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...shareHeaders(accessKey), ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as T;
}

function shareHeaders(accessKey: string) {
  return accessKey.trim() ? { "X-Share-Key": accessKey.trim() } : {};
}

function readRecentRuns(shareID: string): Run[] {
  try {
    return JSON.parse(window.localStorage.getItem(`share-runs:${shareID}`) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentRun(shareID: string, run: Run, previous: Run[]) {
  const next = [run, ...previous.filter((item) => item.id !== run.id)].slice(0, 12);
  window.localStorage.setItem(`share-runs:${shareID}`, JSON.stringify(next));
  return next;
}

function normalizeProgress(value: number | undefined, status: string) {
  if (status === "success") return 100;
  if (typeof value !== "number") return status === "preparing" ? 2 : 8;
  if (value > 0 && value <= 1) return value * 100;
  return Math.max(0, Math.min(100, value));
}
