import { Activity, BarChart3, Clock3, Gauge, Layers3, RadioTower, Route, Server, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { type GlobalStats } from "./api";
import { useResource } from "./hooks";
import { getRelativeTime } from "./lib/getRelativeTime";
import { DailyChart, DeploymentStats, MetricCard, StatsList, formatDuration, formatNumber } from "./workflowStats";

export function StatsPage() {
  const stats = useResource<GlobalStats>("/api/stats");

  useEffect(() => {
    const timer = window.setInterval(() => void stats.reload(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (stats.loading && !stats.data) {
    return (
      <div className="py-6">
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/70" />)}
        </div>
      </div>
    );
  }

  if (stats.error) {
    return <div className="mt-6 rounded-xl border bg-card p-6 text-sm text-red-600">{stats.error}</div>;
  }

  const data = stats.data;
  if (!data) return null;
  const total = Math.max(1, data.overview.total_runs);

  return (
    <div className="flex w-full flex-col gap-4 py-6">
      <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 p-6">
          <div>
            <div className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
              <BarChart3 className="h-6 w-6" />
              Statistics
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Requests across workflows, machines, versions, origins, dates, outputs, and deployments.
            </p>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            {data.overview.latest_run_at ? `Latest ${getRelativeTime(data.overview.latest_run_at)}` : "No requests yet"}
          </div>
        </div>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={<Activity className="h-4 w-4" />} label="Requests" value={formatNumber(data.overview.total_runs)} detail={`${data.overview.total_outputs} outputs`} />
          <MetricCard icon={<Route className="h-4 w-4" />} label="Workflows" value={formatNumber(data.workflows.length)} detail="with request activity" />
          <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Success rate" value={`${data.overview.success_rate}%`} detail={`${data.overview.success_runs} success / ${data.overview.failed_runs} failed`} tone="success" />
          <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Avg runtime" value={formatDuration(data.overview.avg_run_seconds)} detail={`Queue ${formatDuration(data.overview.avg_queue_seconds)}`} />
          <MetricCard icon={<RadioTower className="h-4 w-4" />} label="Active now" value={formatNumber(data.overview.active_runs)} detail="not-started / running / uploading" tone={data.overview.active_runs > 0 ? "success" : "default"} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <StatsList title="Workflows" icon={<Route className="h-4 w-4" />} buckets={data.workflows} total={total} showDuration />
          <StatsList title="Machines" icon={<Server className="h-4 w-4" />} buckets={data.machines} total={total} showDuration />
          <StatsList title="Versions" icon={<Layers3 className="h-4 w-4" />} buckets={data.versions} total={total} showDuration />
          <StatsList title="Origins" icon={<RadioTower className="h-4 w-4" />} buckets={data.origins} total={total} />
          <StatsList title="Status" icon={<Gauge className="h-4 w-4" />} buckets={data.status} total={total} />
        </div>
        <div className="grid gap-4">
          <DailyChart data={data.daily} />
          <DeploymentStats deployments={data.deployments} />
        </div>
      </section>
    </div>
  );
}
