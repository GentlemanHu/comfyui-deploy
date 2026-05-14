import { Activity, BarChart3, Clock3, Gauge, Layers3, RadioTower, Server, Sparkles } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { type WorkflowStats, type WorkflowStatsBucket } from "./api";
import { useResource } from "./hooks";
import { getRelativeTime } from "./lib/getRelativeTime";

export function WorkflowStatsPanel({ workflowID, hasActiveRuns }: { workflowID: string; hasActiveRuns: boolean }) {
  const stats = useResource<WorkflowStats>(`/api/workflow/${workflowID}/stats`);

  useEffect(() => {
    if (!hasActiveRuns) return;
    const timer = window.setInterval(() => void stats.reload(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveRuns]);

  if (stats.loading && !stats.data) {
    return (
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-muted/70" />)}
        </div>
      </section>
    );
  }

  const data = stats.data;
  if (!data) return null;
  const total = Math.max(1, data.overview.total_runs);
  const active = data.overview.active_runs > 0;

  return (
    <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
            <BarChart3 className="h-5 w-5" />
            Statistics
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.overview.latest_run_at ? `Latest run ${getRelativeTime(data.overview.latest_run_at)}` : "No runs yet"}
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${active ? "bg-emerald-500/10 text-emerald-700" : "text-muted-foreground"}`}>
          <span className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40"}`} />
          {active ? `${data.overview.active_runs} active` : "Live"}
        </div>
      </div>

      <div className="grid gap-3 px-6 pb-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Activity className="h-4 w-4" />} label="Total runs" value={formatNumber(data.overview.total_runs)} detail={`${data.overview.total_outputs} outputs`} />
        <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Success rate" value={`${data.overview.success_rate}%`} detail={`${data.overview.success_runs} success / ${data.overview.failed_runs} failed`} tone="success" />
        <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Avg runtime" value={formatDuration(data.overview.avg_run_seconds)} detail={`Queue ${formatDuration(data.overview.avg_queue_seconds)}`} />
        <MetricCard icon={<RadioTower className="h-4 w-4" />} label="Active now" value={formatNumber(data.overview.active_runs)} detail="not-started / running / uploading" tone={active ? "success" : "default"} />
      </div>

      <div className="grid gap-4 border-t p-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <StatsList title="Status" icon={<Gauge className="h-4 w-4" />} buckets={data.status} total={total} />
          <StatsList title="Origin" icon={<Layers3 className="h-4 w-4" />} buckets={data.origins} total={total} />
          <StatsList title="Machines" icon={<Server className="h-4 w-4" />} buckets={data.machines} total={total} showDuration />
          <StatsList title="Versions" icon={<Layers3 className="h-4 w-4" />} buckets={data.versions} total={total} showDuration />
        </div>

        <div className="grid gap-4">
          <DailyChart data={data.daily} />
          <DeploymentStats deployments={data.deployments} />
        </div>
      </div>
    </section>
  );
}

export function MetricCard({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "default" | "success" }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "success" ? "bg-emerald-500/5" : "bg-background/60"}`}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export function StatsList({ title, icon, buckets, total, showDuration = false }: { title: string; icon: React.ReactNode; buckets: WorkflowStatsBucket[]; total: number; showDuration?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <div className="mb-4 flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <div className="grid gap-3">
        {buckets.length === 0 ? <div className="text-sm text-muted-foreground">No data</div> : buckets.slice(0, 6).map((bucket) => (
          <div key={`${title}-${bucket.key}`} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{bucket.label}</span>
              <span className="shrink-0 text-muted-foreground">{bucket.count} · {bucket.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={barColor(bucket.key)} style={{ width: `${Math.max(3, (bucket.count / total) * 100)}%` }} />
            </div>
            {showDuration && bucket.avg_seconds !== undefined ? <div className="text-xs text-muted-foreground">Avg {formatDuration(bucket.avg_seconds)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DailyChart({ data }: { data: WorkflowStats["daily"] }) {
  const max = Math.max(1, ...data.map((item) => item.total));
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-medium">Last 14 days</div>
        <div className="text-xs text-muted-foreground">total / success / failed</div>
      </div>
      <div className="flex h-40 items-end gap-2">
        {data.map((item) => (
          <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full max-w-9 items-end rounded-t-md bg-muted/60">
              <div className="w-full rounded-t-md bg-zinc-900 transition-all group-hover:bg-zinc-700" style={{ height: `${Math.max(item.total ? 8 : 2, (item.total / max) * 100)}%` }} />
            </div>
            <div className="w-full truncate text-center text-[10px] text-muted-foreground">{item.date.slice(5)}</div>
            <div className="sr-only">{item.date}: {item.total} total, {item.success} success, {item.failed} failed, {item.active} active</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeploymentStats({ deployments }: { deployments: WorkflowStats["deployments"] }) {
  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <div className="mb-4 font-medium">Deployment performance</div>
      <div className="grid gap-3">
        {deployments.length === 0 ? <div className="text-sm text-muted-foreground">No deployments</div> : deployments.map((item) => (
          <div key={item.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md border px-2 py-0.5 text-xs font-medium">{item.environment}</span>
                <span className="text-sm text-muted-foreground">v{item.version ?? "-"} · {item.machine_name ?? "Unknown machine"}</span>
              </div>
              <span className="text-sm font-medium">{item.success_rate}% success</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <MiniStat label="Runs" value={String(item.runs)} />
              <MiniStat label="Success" value={String(item.success_runs)} />
              <MiniStat label="Last run" value={item.last_run_at ? getRelativeTime(item.last_run_at) : "-"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function barColor(key: string) {
  if (key === "success") return "h-full rounded-full bg-emerald-500";
  if (key === "failed") return "h-full rounded-full bg-red-500";
  if (key === "running" || key === "uploading" || key === "not-started") return "h-full rounded-full bg-zinc-700";
  return "h-full rounded-full bg-zinc-400";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function formatDuration(seconds?: number) {
  if (seconds === undefined || Number.isNaN(seconds)) return "-";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
