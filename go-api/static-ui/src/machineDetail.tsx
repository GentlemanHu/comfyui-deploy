import { Loader2 } from "lucide-react";
import { useResource } from "./hooks";
import { type Machine } from "./api";
import { getRelativeTime } from "./lib/getRelativeTime";
import { ScrollArea } from "./components/ui/scroll-area";

export function MachineDetail({ machineID }: { machineID: string }) {
  const machine = useResource<Machine>(`/api/machines/${machineID}`);

  if (machine.loading) {
    return <div className="h-full w-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (machine.error || !machine.data) {
    return <div className="h-full w-full flex items-center justify-center text-sm text-destructive">{machine.error || "Machine not found."}</div>;
  }

  const item = machine.data;

  return (
    <div>
      <div className="w-full h-fit mt-4 rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="text-2xl font-semibold leading-none tracking-tight">{item.name}</div>
          <div className="text-sm text-muted-foreground">{getRelativeTime(item.updated_at)}</div>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <div className="rounded-md border p-4 grid gap-3 text-sm">
            <div className="grid grid-cols-[120px,1fr] gap-3">
              <span className="font-medium">Endpoint</span>
              <code className="break-all text-xs">{item.endpoint}</code>
            </div>
            <div className="grid grid-cols-[120px,1fr] gap-3">
              <span className="font-medium">Type</span>
              <span>{item.type}</span>
            </div>
            <div className="grid grid-cols-[120px,1fr] gap-3">
              <span className="font-medium">Status</span>
              <span>{item.disabled ? "disabled" : item.status}</span>
            </div>
          </div>

          {item.status === "building" || item.build_log ? (
            <div className="rounded-md border p-4">
              <div className="mb-2 font-medium">Build Log</div>
              <ScrollArea className="max-h-[420px]">
                <pre className="text-xs whitespace-pre-wrap break-all">{formatBuildLog(item.build_log, item.status)}</pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="rounded-md border p-4">
              <div className="mb-2 font-medium">Machine Detail</div>
              <pre className="text-xs whitespace-pre-wrap break-all max-h-[420px] overflow-auto">{JSON.stringify({ models: item.models, snapshot: item.snapshot }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBuildLog(buildLog: string | undefined, status: string) {
  if (buildLog && buildLog.trim()) return buildLog;
  if (status === "building") return "Machine build is still running...";
  return "No build log available.";
}
