import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Server } from "lucide-react";

type Machine = {
  id: string;
  name: string;
  endpoint: string;
  type: string;
  status: string;
  disabled: boolean;
  snapshot?: unknown;
  models?: unknown;
  updated_at: string;
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export function MachineDetail({ machineID, onBack }: { machineID: string; onBack: () => void }) {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Machine>(`/api/machines/${machineID}`).then(setMachine).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [machineID]);

  return (
    <div className="detailApp">
      <header className="detailTopbar">
        <button className="iconButton" onClick={onBack} title="Back"><ArrowLeft size={17} /></button>
        <div>
          <h1>{machine?.name ?? "Machine"}</h1>
          <p>{machineID}</p>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {!machine && !error && <div className="grantPage"><Loader2 className="spin" size={24} /></div>}
      {machine && (
        <section className="panel">
          <div className="panelTitle"><h2><Server size={18} />Machine Detail</h2></div>
          <div className="table">
            <div className="row"><span className="strong">Endpoint</span><code>{machine.endpoint}</code><span>{machine.status}</span></div>
            <div className="row"><span className="strong">Type</span><span>{machine.type}</span><span>{machine.disabled ? "disabled" : "enabled"}</span></div>
            <div className="row"><span className="strong">Updated</span><span>{formatDate(machine.updated_at)}</span><span></span></div>
          </div>
          <div className="outputBox">
            <pre>{JSON.stringify({ models: machine.models, snapshot: machine.snapshot }, null, 2)}</pre>
          </div>
        </section>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
