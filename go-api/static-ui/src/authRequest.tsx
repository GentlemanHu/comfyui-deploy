import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

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

export function AuthRequest({ requestID }: { requestID: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const grant = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ message: string }>(`/api/auth-request/${requestID}`, { method: "POST", body: "{}" });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col gap-2 items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm min-w-[320px]">
        <div className="brandMark"><KeyRound size={22} /></div>
        <div className="text-lg">Grant API Access to Local Admin</div>
        <code className="text-xs text-muted-foreground">{requestID || "No valid request_id"}</code>
        {error && <div className="error w-full">{error}</div>}
        {message && <div className="successBox w-full">{message}</div>}
        <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={grant} disabled={loading || !requestID}>
          {loading ? <Loader2 className="spin mr-2" size={16} /> : <KeyRound className="mr-2" size={16} />} Grant Access
        </button>
      </div>
    </div>
  );
}
