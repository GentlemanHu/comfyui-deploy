import { Copy, Info, Loader2, MoreHorizontal, MoreVertical, Play } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, type Deployment, type Machine, navigate, type Run, type WorkflowItem, type WorkflowVersion } from "./api";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { ScrollArea } from "./components/ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useResource } from "./hooks";
import { fileToRunInput, getInputsFromWorkflow, type ExternalInputDefinition } from "./lib/externalInputs";
import { getRelativeTime } from "./lib/getRelativeTime";
import { RunsTable } from "./workflowRuns";
import { WorkflowStatsPanel } from "./workflowStats";
export function WorkflowDetail({ workflowID }: { workflowID: string }) {
  const workflow = useResource<WorkflowItem>(`/api/workflow/${workflowID}`);
  const versions = useResource<WorkflowVersion[]>(`/api/workflow/${workflowID}/versions?limit=50`);
  const deployments = useResource<Deployment[]>(`/api/workflow/${workflowID}/deployments`);
  const runs = useResource<Run[]>(`/api/workflow/${workflowID}/runs?limit=80`);
  const machines = useResource<Machine[]>("/api/machines");
  const [selectedVersionID, setSelectedVersionID] = useState("");
  const [selectedMachineID, setSelectedMachineID] = useState("");
  const reloadAll = async () => {
    await Promise.all([workflow.reload(), versions.reload(), deployments.reload(), runs.reload(), machines.reload()]);
  };
  useEffect(() => {
    if (!(runs.data ?? []).some((run) => run.status === "running" || run.status === "not-started" || run.status === "preparing")) return;
    const timer = window.setInterval(() => void runs.reload(), 2000);
    return () => window.clearInterval(timer);
  }, [runs.data]);
  const versionOptions = versions.data ?? [];
  const machineOptions = machines.data ?? [];
  const activeVersion = versionOptions.find((item) => item.id === (selectedVersionID || versionOptions[0]?.id)) ?? versionOptions[0];
  const activeMachineID = selectedMachineID || machineOptions[0]?.id || "";
  const workflowGraph = activeVersion?.workflow as any;
  const hasActiveRuns = (runs.data ?? []).some((run) => run.status === "running" || run.status === "not-started" || run.status === "preparing" || run.status === "uploading");
  return (
    <div className="mt-4 flex w-full flex-col gap-4">
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(auto,500px),1fr]">
        <div className="flex min-w-0 w-full flex-col gap-4">
          <div className="h-fit w-full rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="text-2xl font-semibold leading-none tracking-tight">{workflow.data?.name ?? "Workflow"}</div>
            <div className="text-sm text-muted-foreground">{workflow.data?.updated_at ? getRelativeTime(workflow.data.updated_at) : "-"}</div>
          </div>

          <div className="p-6 pt-0">
            <div className="flex flex-wrap gap-2">
              <select className="h-10 w-[100px] rounded-md border bg-background px-3" value={selectedVersionID || versionOptions[0]?.id || ""} onChange={(e) => setSelectedVersionID(e.target.value)}>
                {versionOptions.map((item) => <option key={item.id} value={item.id}>{item.version}</option>)}
              </select>
              <select className="h-10 w-[180px] rounded-md border bg-background px-3 text-start" value={activeMachineID} onChange={(e) => setSelectedMachineID(e.target.value)}>
                {machineOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <RunWorkflowButton workflowVersion={activeVersion} machineID={activeMachineID} onCreated={runs.reload} />
              <CreateDeploymentMenu workflowID={workflowID} versionID={activeVersion?.id} machineID={activeMachineID} onCreated={deployments.reload} />
              <CreateShareButton workflowID={workflowID} versions={versionOptions} machines={machineOptions} onCreated={deployments.reload} presetVersionID={activeVersion?.id} presetMachineID={activeMachineID} />
              <CopyWorkflowVersion workflow={workflowGraph} workflowAPI={activeVersion?.workflow_api} workflowID={workflowID} version={activeVersion?.version} />
              <ViewWorkflowDetailsButton workflow={workflowGraph} workflowAPI={activeVersion?.workflow_api} />
              <Button variant="outline" onClick={() => void reloadAll()}>
                {workflow.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>

            <VersionDetails versions={versionOptions} />
          </div>
          </div>
          <div className="h-fit w-full rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <div className="text-2xl font-semibold leading-none tracking-tight">Deployments</div>
            </div>
            <div className="p-6 pt-0">
              <DeploymentsTable data={deployments.data ?? []} onChanged={deployments.reload} />
            </div>
          </div>
        </div>

        <div className="h-fit w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="text-2xl font-semibold leading-none tracking-tight">Runs</div>
          </div>
          <div className="p-6 pt-0">
            <RunsTable data={runs.data ?? []} />
          </div>
        </div>
      </div>
      <WorkflowStatsPanel workflowID={workflowID} hasActiveRuns={hasActiveRuns} />
    </div>
  );
}
function VersionDetails({ versions }: { versions: WorkflowVersion[] }) {
  if (versions.length === 0) return null;
  const current = versions[0];
  return (
    <div className="mt-4 rounded-md border p-4 text-sm">
      <div className="font-medium">Latest Version</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-600/10 px-2 py-0.5 text-sm font-medium text-zinc-700">v{current.version}</span>
        <code className="break-all text-xs">{current.id}</code>
        <span className="text-muted-foreground">{getRelativeTime(current.created_at)}</span>
      </div>
    </div>
  );
}

function CreateShareButton(props: { workflowID: string; versions: WorkflowVersion[]; machines: Machine[]; onCreated: () => Promise<void>; presetVersionID?: string; presetMachineID?: string }) {
  return <DeploymentDialog {...props} environment="public-share" title="Create Share Page" buttonLabel="Share" />;
}

function CreateDeploymentMenu({ workflowID, versionID, machineID, onCreated }: { workflowID: string; versionID?: string; machineID?: string; onCreated: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" disabled={saving} variant="outline">Deploy {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical size={14} />}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {["production", "staging"].map((environment) => (
          <DropdownMenuItem key={environment} onClick={async () => {
            if (!versionID || !machineID) return;
            setSaving(true);
            try {
              await api(`/api/workflow/${workflowID}/deployments`, { method: "POST", body: JSON.stringify({ version_id: versionID, machine_id: machineID, environment }) });
              await onCreated();
              toast.success(`${environment[0].toUpperCase()}${environment.slice(1)} deployment created`);
            } finally {
              setSaving(false);
            }
          }}>
            {environment[0].toUpperCase()}{environment.slice(1)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeploymentDialog({ workflowID, versions, machines, onCreated, environment, title, buttonLabel, presetVersionID, presetMachineID }: { workflowID: string; versions: WorkflowVersion[]; machines: Machine[]; onCreated: () => Promise<void>; environment: string; title: string; buttonLabel: string; presetVersionID?: string; presetMachineID?: string }) {
  const [open, setOpen] = useState(false);
  const [versionID, setVersionID] = useState("");
  const [machineID, setMachineID] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const selectedVersionID = versionID || presetVersionID || versions[0]?.id;
    const selectedMachineID = machineID || presetMachineID || machines[0]?.id;
    if (!selectedVersionID || !selectedMachineID) {
      toast.error("Missing version or machine");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/workflow/${workflowID}/deployments`, { method: "POST", body: JSON.stringify({ version_id: selectedVersionID, machine_id: selectedMachineID, environment }) });
      await onCreated();
      setOpen(false);
      toast.success(`${title} created`);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>{buttonLabel}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Select version and machine.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Version</div>
            <select className="h-10 rounded-md border bg-background px-3" value={versionID || versions[0]?.id || ""} onChange={(e) => setVersionID(e.target.value)}>
              {versions.map((item) => <option key={item.id} value={item.id}>v{item.version}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <div className="text-sm font-medium">Machine</div>
            <select className="h-10 rounded-md border bg-background px-3" value={machineID || machines[0]?.id || ""} onChange={(e) => setMachineID(e.target.value)}>
              {machines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {buttonLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunWorkflowButton({ workflowVersion, machineID, onCreated }: { workflowVersion?: WorkflowVersion; machineID?: string; onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputs = useMemo(() => getInputsFromWorkflow((workflowVersion?.workflow_api as Record<string, any>) || undefined), [workflowVersion]);
  const [values, setValues] = useState<Record<string, any>>({});
  const canRun = Boolean(workflowVersion?.id && machineID);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={!canRun}>Run <Play size={14} /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm run</DialogTitle>
          <DialogDescription>{inputs.length > 0 ? "Run your workflow with custom inputs" : "Confirm to run your workflow"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {inputs.map((item) => <InputField key={item.input_id} item={item} values={values} setValues={setValues} />)}
          <Button className="gap-2" disabled={!canRun || saving} onClick={async () => {
            if (!workflowVersion?.id || !machineID) return;
            setSaving(true);
            try {
              await api(`/api/run`, {
                method: "POST",
                body: JSON.stringify({
                  workflow_version_id: workflowVersion.id,
                  machine_id: machineID,
                  inputs: Object.keys(values).length > 0 ? values : undefined,
                  run_origin: "manual",
                }),
              });
              await onCreated();
              toast.success("Run created");
              setOpen(false);
            } catch (error) {
              toast.error(String(error));
            } finally {
              setSaving(false);
            }
          }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={14} />}Run
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InputField({ item, values, setValues }: { item: ExternalInputDefinition; values: Record<string, any>; setValues: Dispatch<SetStateAction<Record<string, any>>> }) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{item.display_name || item.input_id}</div>
      {item.value_type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(values[item.input_id] ?? item.default_value ?? false)} onChange={(e) => setValues((prev) => ({ ...prev, [item.input_id]: e.target.checked }))} />
          <span>Enabled</span>
        </label>
      ) : item.value_type === "file" ? (
        <div className="grid gap-2">
          <input
            className="h-10 rounded-md border bg-background px-3 py-2 text-sm"
            type="file"
            accept={item.accept}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setValues((prev) => ({ ...prev, [item.input_id]: { filename: file.name, mime_type: file.type, uploading: true } }));
              try {
                const value = await fileToRunInput(file);
                setValues((prev) => ({ ...prev, [item.input_id]: value }));
              } catch (error) {
                toast.error(String(error));
              }
            }}
          />
          {values[item.input_id]?.filename ? <div className="truncate text-xs text-muted-foreground">{values[item.input_id].filename}</div> : null}
        </div>
      ) : item.value_type === "enum" && item.options?.length ? (
        <select className="h-10 rounded-md border bg-background px-3" value={String(values[item.input_id] ?? item.default_value ?? item.options[0] ?? "")} onChange={(e) => setValues((prev) => ({ ...prev, [item.input_id]: e.target.value }))}>
          {item.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input className="h-10 rounded-md border bg-background px-3" type={item.value_type === "number" || item.value_type === "integer" ? "number" : "text"} defaultValue={String(item.default_value ?? "")} onChange={(e) => setValues((prev) => ({ ...prev, [item.input_id]: item.value_type === "number" || item.value_type === "integer" ? Number(e.target.value) : e.target.value }))} />
      )}
    </div>
  );
}

function CopyWorkflowVersion({ workflow, workflowAPI, workflowID, version }: { workflow: any; workflowAPI: unknown; workflowID: string; version?: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline">Copy Workflow <Copy size={14} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem onClick={async () => {
          const clonedWorkflow = workflow ? JSON.parse(JSON.stringify(workflow)) : null;
          clonedWorkflow?.nodes?.forEach((node: any) => {
            if (node?.type === "ComfyDeploy") {
              node.widgets_values[1] = workflowID;
              node.widgets_values[2] = version;
            }
          });
          await navigator.clipboard.writeText(JSON.stringify(clonedWorkflow, null, 2));
          toast.success("Copied workflow JSON");
        }}>
          Copy (JSON)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => {
          await navigator.clipboard.writeText(JSON.stringify(workflowAPI, null, 2));
          toast.success("Copied API JSON");
        }}>
          Copy API (JSON)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewWorkflowDetailsButton({ workflow, workflowAPI }: { workflow: unknown; workflowAPI: unknown }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="outline">Details <Info size={14} /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Workflow details</DialogTitle>
          <DialogDescription>Raw workflow and workflow API data.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="workflow">
          <TabsList className="mb-4 grid w-fit grid-cols-2">
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="workflow-api">Workflow API</TabsTrigger>
          </TabsList>
          <TabsContent value="workflow">
            <PreBlock value={workflow} />
          </TabsContent>
          <TabsContent value="workflow-api">
            <PreBlock value={workflowAPI} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PreBlock({ value }: { value: unknown }) {
  return (
    <ScrollArea className="max-h-[600px] rounded-md border p-4">
      <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
    </ScrollArea>
  );
}

function DeploymentsTable({ data, onChanged }: { data: Deployment[]; onChanged: () => Promise<void> }) {
  return (
    <div className="h-fit w-full overflow-auto">
      <Table>
        <TableCaption>A list of your deployments</TableCaption>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-[120px]">Environment</TableHead>
            <TableHead className="w-[100px]">Version</TableHead>
            <TableHead>Machine</TableHead>
            <TableHead className="text-right">Updated At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => item.environment === "public-share" ? (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/share/${item.share_slug ?? item.id}/settings`)}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-x-1.5 rounded-md bg-green-500/15 px-2 py-0.5 text-sm font-medium text-green-700">{item.environment}</span>
                  <span className="text-xs text-muted-foreground">Manage Share Page</span>
                </div>
              </TableCell>
              <TableCell>v{item.version ?? "-"}</TableCell>
              <TableCell>{item.machine_name ?? item.machine_id}</TableCell>
              <TableCell className="text-right">{getRelativeTime(item.updated_at)}</TableCell>
            </TableRow>
          ) : (
            <DeploymentCodeDialog key={item.id} item={item} onDeleted={onChanged} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DeploymentCodeDialog({ item, onDeleted }: { item: Deployment; onDeleted: () => Promise<void> }) {
  const snippets = createDeploymentSnippets(item);
  return (
    <Dialog>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <TableRow>
          <TableCell><span className="inline-flex items-center gap-x-1.5 rounded-md border px-2 py-0.5 text-sm font-medium text-foreground">{item.environment}</span></TableCell>
          <TableCell>v{item.version ?? "-"}</TableCell>
          <TableCell>{item.machine_name ?? item.machine_id}</TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span>{getRelativeTime(item.updated_at)}</span>
              <RowMenu items={[{ label: "Delete Deployment", destructive: true, action: async () => { await api(`/api/deployments/${item.id}`, { method: "DELETE" }); await onDeleted(); } }]} />
            </div>
          </TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="capitalize">{item.environment} Deployment</DialogTitle>
          <DialogDescription>Code for your deployment client</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[600px] pr-4">
          <Tabs defaultValue="client" className="w-full gap-2 text-sm">
            <TabsList className="mb-2 grid w-fit grid-cols-3">
              <TabsTrigger value="client">Server Client</TabsTrigger>
              <TabsTrigger value="js">NodeJS Fetch</TabsTrigger>
              <TabsTrigger value="curl">CURL</TabsTrigger>
            </TabsList>
            <TabsContent className="!mt-0 flex flex-col gap-3" value="client">
              <CodeSnippet code={snippets.clientSetup} />
              <CodeSnippet code={snippets.clientRun} />
              <CodeSnippet code={snippets.clientStatus} />
            </TabsContent>
            <TabsContent className="!mt-0 flex flex-col gap-3" value="js">
              <CodeSnippet code={snippets.fetchRun} />
              <CodeSnippet code={snippets.fetchStatus} />
            </TabsContent>
            <TabsContent className="!mt-2 flex flex-col gap-3" value="curl">
              <CodeSnippet code={snippets.curlRun} />
              <CodeSnippet code={snippets.curlStatus} />
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs whitespace-pre-wrap break-all">{code}</pre>;
}

function createDeploymentSnippets(item: Deployment) {
  const base = window.location.origin;
  return {
    clientSetup: `const client = new ComfyDeployClient({\n  apiBase: "${base}",\n  apiToken: process.env.COMFY_DEPLOY_API_KEY!,\n});`,
    clientRun: `const { run_id } = await client.run("${item.id}", {\n  inputs: {}\n});`,
    clientStatus: `const run = await client.getRun(run_id);`,
    fetchRun: `const { run_id } = await fetch("${base}/api/run", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer " + process.env.COMFY_DEPLOY_API_KEY,\n  },\n  body: JSON.stringify({\n    deployment_id: "${item.id}",\n    inputs: {}\n  }),\n}).then((response) => response.json());`,
    fetchStatus: `const output = await fetch("${base}/api/run/<RUN_ID>", {\n  method: "GET",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer " + process.env.COMFY_DEPLOY_API_KEY,\n  },\n}).then((response) => response.json());`,
    curlRun: `curl --request POST \\\n  --url "${base}/api/run" \\\n  --header "Content-Type: application/json" \\\n  --header "Authorization: Bearer $COMFY_DEPLOY_API_KEY" \\\n  --data '{\n    "deployment_id": "${item.id}"\n  }'`,
    curlStatus: `curl --request GET \\\n  --url "${base}/api/run/<RUN_ID>" \\\n  --header "Content-Type: application/json" \\\n  --header "Authorization: Bearer $COMFY_DEPLOY_API_KEY"`,
  };
}

function RowMenu({ items }: { items: { label: string; destructive?: boolean; action: () => Promise<void> }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.label} className={item.destructive ? "text-destructive" : ""} onClick={() => item.action().then(() => toast.success(item.label)).catch((err) => toast.error(String(err)))}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
