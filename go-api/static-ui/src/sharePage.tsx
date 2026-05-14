import { useEffect, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";

type ShareData = {
  workflow_name: string;
  deployment: {
    id: string;
    workflow_id: string;
    machine_id: string;
    environment: string;
    description?: string;
    showcase_media?: unknown;
  };
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export function SharePage({ shareID }: { shareID: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<ShareData>(`/api/share/${shareID}`).then(setData).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [shareID]);

  if (error) {
    return <div className="grantPage"><div className="grantPanel"><h1>Share not found</h1><pre>{error}</pre></div></div>;
  }
  if (!data) {
    return <div className="grantPage"><Loader2 className="spin" size={24} /></div>;
  }
  return (
    <div className="sharePage">
      <header className="shareHero">
        <div className="brandMark"><Globe2 size={22} /></div>
        <h1>{data.workflow_name}</h1>
        <p>{data.deployment.description || "Public ComfyDeploy workflow"}</p>
      </header>
      <section className="panel sharePanel">
        <div className="panelTitle"><h2><Globe2 size={18} />Deployment</h2></div>
        <div className="table">
          <div className="row"><span className="strong">Deployment ID</span><code>{data.deployment.id}</code><span>{data.deployment.environment}</span></div>
          <div className="row"><span className="strong">Workflow ID</span><code>{data.deployment.workflow_id}</code><span></span></div>
          <div className="row"><span className="strong">Machine ID</span><code>{data.deployment.machine_id}</code><span></span></div>
        </div>
      </section>
    </div>
  );
}
