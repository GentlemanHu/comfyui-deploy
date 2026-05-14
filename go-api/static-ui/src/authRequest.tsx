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
    <div className="grantPage">
      <div className="grantPanel">
        <div className="brandMark"><KeyRound size={22} /></div>
        <h1>Grant API Access</h1>
        <p>Authorize this ComfyUI plugin session to receive a temporary ComfyDeploy API key.</p>
        <code>{requestID}</code>
        {error && <div className="error">{error}</div>}
        {message && <div className="successBox">{message}</div>}
        <button className="primary" onClick={grant} disabled={loading || !requestID}>
          {loading ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />} Grant Access
        </button>
      </div>
    </div>
  );
}
