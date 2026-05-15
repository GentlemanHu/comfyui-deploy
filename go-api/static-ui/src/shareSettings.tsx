import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, navigate } from "./api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";

export function ShareSettings({ shareID }: { shareID: string }) {
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [deploymentID, setDeploymentID] = useState(shareID);
  const [shareSlug, setShareSlug] = useState(shareID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<any>(`/api/share/${shareID}`).then((data) => {
      setDeploymentID(data.deployment.id);
      setShareSlug(data.deployment.share_slug ?? data.deployment.id);
      setDescription(data.deployment.description ?? "");
      setAccessKey(data.deployment.access_key ?? "");
      setMedia(JSON.stringify(data.deployment.showcase_media ?? [], null, 2));
    }).catch((err) => toast.error(String(err))).finally(() => setLoading(false));
  }, [shareID]);

  return (
    <div className="flex h-full items-center justify-center py-8">
      <div className="w-full max-w-[600px] rounded-xl border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b p-6">
          <div>
            <h1 className="text-2xl font-semibold">Share Page</h1>
            <p className="text-sm text-muted-foreground">Edit share page details.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-4 p-6">
          <Input value={deploymentID} disabled />
          <div className="grid gap-2">
            <div className="text-sm font-medium">Page key</div>
            <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="Optional. Visitors must enter this key before viewing or running." disabled={loading} />
            <p className="text-xs text-muted-foreground">Leave empty for a public page. This key is per share page.</p>
          </div>
          <Textarea className="min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" disabled={loading} />
          <Textarea className="min-h-40 font-mono text-xs" value={media} onChange={(e) => setMedia(e.target.value)} placeholder="Showcase media JSON" disabled={loading} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" onClick={async () => {
              await api(`/api/share/${deploymentID}/settings`, { method: "DELETE" });
              toast.success("Share removed");
              navigate("/workflows");
            }}>
              Remove
            </Button>
            <Button variant="outline" type="button" onClick={() => window.open(`/share/${shareSlug}`, "_blank", "noopener,noreferrer")}>
              View Share Page <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={async () => {
                let showcase_media = null;
                try {
                  showcase_media = media.trim() ? JSON.parse(media) : [];
                } catch {
                  toast.error("Invalid showcase media JSON");
                  return;
                }
                await api(`/api/share/${deploymentID}/settings`, { method: "PATCH", body: JSON.stringify({ description, showcase_media, access_key: accessKey }) });
                toast.success("Info Updated");
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
