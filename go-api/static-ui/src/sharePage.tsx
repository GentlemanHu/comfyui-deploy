import { Loader2, MoreVertical, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, navigate } from "./api";
import { useResource } from "./hooks";
import { MediaPreviewGrid } from "./components/MediaPreview";
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
};

export function SharePage({ shareID }: { shareID: string }) {
  const shared = useResource<ShareData>(`/api/share/${shareID}`);
  const [runState, setRunState] = useState<RunStatus | null>(null);
  const [runMedia, setRunMedia] = useState<Array<{ url?: string; filename?: string }>>([]);

  useEffect(() => {
    if (!runState?.run_id || runState.status === "success" || runState.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const run = await api<{ id: string; status: string }>(`/api/run/${runState.run_id}`);
        setRunState({ run_id: run.id, status: run.status });
        if (run.status === "success") {
          const outputs = await api<Array<{ data: any }>>(`/api/run/${runState.run_id}/outputs`);
          const items = outputs.flatMap((item) => {
            const images = Array.isArray(item.data?.images) ? item.data.images : [];
            const gifs = Array.isArray(item.data?.gifs) ? item.data.gifs : [];
            const files = Array.isArray(item.data?.files) ? item.data.files : [];
            return [...images, ...gifs, ...files];
          });
          setRunMedia(items);
        }
      } catch (error) {
        console.error(error);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [runState]);

  if (shared.loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (shared.error || !shared.data) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-destructive">{shared.error || "Share not found"}</div>;
  }

  const item = shared.data.deployment;
  const inputs = getInputsFromWorkflow(item.workflow_api);
  const title = shared.data.owner_name ? `${shared.data.owner_name} / ${shared.data.workflow_name}` : shared.data.workflow_name;

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
                  const result = await api<{ workflow_id: string; message: string }>(`/api/share/${shareID}/clone-workflow`, { method: "POST" });
                  toast.success(result.message);
                  navigate(`/workflows/${result.workflow_id}`);
                }}>
                  Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const result = await api<{ machine_id: string; message: string }>(`/api/share/${shareID}/clone-machine`, { method: "POST" });
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
            inputs={inputs}
            onStarted={(runID) => {
              setRunMedia([]);
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
          {runState && runState.status !== "success" ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
              <span className="mr-2 capitalize">{runState.status}</span>
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <MediaPreviewGrid
              items={runMedia.length > 0 ? runMedia : item.showcase_media ?? []}
              runID={runMedia.length > 0 ? runState?.run_id : undefined}
              emptyText="No preview outputs."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ShareRunForm({ deploymentID, inputs, onStarted }: { deploymentID: string; inputs: ExternalInputDefinition[]; onStarted: (runID: string) => void }) {
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
        disabled={running}
        onClick={async () => {
          setRunning(true);
          try {
            const result = await api<{ run_id: string }>(`/api/run`, {
              method: "POST",
              body: JSON.stringify({ deployment_id: deploymentID, inputs: Object.keys(values).length > 0 ? values : undefined }),
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
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run
      </Button>
    </div>
  );
}
