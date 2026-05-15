import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type Run } from "./api";
import { MediaPreviewGrid, extractMediaItems } from "./components/MediaPreview";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { ScrollArea } from "./components/ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { useResource } from "./hooks";
import { getRelativeTime } from "./lib/getRelativeTime";

type RunOutput = { id: string; data: unknown; created_at: string; updated_at?: string };

export function RunsTable({ data }: { data: Run[] }) {
  return (
    <div className="h-fit w-full overflow-auto">
      <Table>
        {data.length === 0 && <TableCaption>A list of your recent runs.</TableCaption>}
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="truncate">Machine</TableHead>
            <TableHead className="truncate">Time</TableHead>
            <TableHead className="truncate">Version</TableHead>
            <TableHead className="truncate">Origin</TableHead>
            <TableHead className="truncate">Progress</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((run) => <RunRow key={run.id} run={run} />)}
        </TableBody>
      </Table>
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const outputs = useResource<RunOutput[]>(open ? `/api/run/${run.id}/outputs` : null);
  const running = ["running", "uploading", "not-started", "preparing"].includes(run.status);
  useEffect(() => {
    if (!open || !running) return;
    const timer = window.setInterval(() => void outputs.reload(), 2000);
    return () => window.clearInterval(timer);
  }, [open, running]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell className="truncate font-medium">{run.machine_name ?? run.machine_id ?? "-"}</TableCell>
        <TableCell className="truncate">{getRelativeTime(run.created_at)}</TableCell>
        <TableCell>{run.version ?? "-"}</TableCell>
        <TableCell><span className="inline-flex items-center gap-x-1.5 rounded-md border px-2 py-0.5 text-sm font-medium text-foreground truncate">{run.origin}</span></TableCell>
        <TableCell><RunProgress run={run} /></TableCell>
        <TableCell className="text-right"><span className={statusClassName(run.status)}>{run.status}</span></TableCell>
      </TableRow>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Run outputs</DialogTitle>
          <DialogDescription>You can view your run&apos;s outputs here</DialogDescription>
        </DialogHeader>
        {outputs.loading && !outputs.data ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (outputs.data ?? []).length > 0 ? (
          <RunOutputsTable outputs={outputs.data ?? []} runID={run.id} running={running} />
        ) : running ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
            <span className="mr-2 capitalize">{run.status}</span>
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <PreBlock value={outputs.data ?? []} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunProgress({ run }: { run: Run }) {
  const progress = typeof run.progress === "number" ? Math.max(0, Math.min(100, run.progress)) : undefined;
  if (progress === undefined && !run.current_node) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="min-w-[140px]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{run.current_node || "Running"}</span>
        {progress !== undefined ? <span>{Math.round(progress)}%</span> : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${progress ?? 12}%` }} />
      </div>
    </div>
  );
}

function RunOutputsTable({ outputs, runID, running }: { outputs: RunOutput[]; runID: string; running: boolean }) {
  return (
    <ScrollArea className="max-h-[70vh] rounded-md border">
      <Table className="table-fixed">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-[200px]">File</TableHead>
            <TableHead>Output</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {outputs.map((output, index) => {
            const items = extractMediaItems(output.data);
            const fileName = outputFileName(output.data, index);
            return (
              <TableRow key={output.id}>
                <TableCell className="break-words align-top">{fileName}</TableCell>
                <TableCell>
                  {items.length > 0 ? (
                    <MediaPreviewGrid items={items} runID={runID} compact />
                  ) : (
                    <pre className="max-h-[260px] overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(output.data, null, 2)}</pre>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {running ? (
            <TableRow>
              <TableCell className="text-muted-foreground">Running</TableCell>
              <TableCell>
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for more outputs
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function PreBlock({ value }: { value: unknown }) {
  return (
    <ScrollArea className="max-h-[600px] rounded-md border p-4">
      <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
    </ScrollArea>
  );
}

function outputFileName(data: unknown, index: number) {
  const items = extractMediaItems(data);
  return items[0]?.filename || `Output ${index + 1}`;
}

function statusClassName(status: string) {
  if (status === "success") return "inline-flex items-center gap-x-1.5 rounded-md bg-green-500/15 px-2 py-0.5 text-sm font-medium text-green-700";
  if (status === "running" || status === "uploading" || status === "not-started") return "inline-flex items-center gap-x-1.5 rounded-md bg-zinc-600/10 px-2 py-0.5 text-sm font-medium text-zinc-700";
  return "inline-flex items-center gap-x-1.5 rounded-md bg-red-500/15 px-2 py-0.5 text-sm font-medium text-red-700";
}
