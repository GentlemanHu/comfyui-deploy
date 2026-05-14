import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";

export function ShareSettings({ shareID }: { shareID: string }) {
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState("");
  const [deploymentID, setDeploymentID] = useState(shareID);

  useEffect(() => {
    api<any>(`/api/share/${shareID}`).then((data) => {
      setDeploymentID(data.deployment.id);
      setDescription(data.deployment.description ?? "");
      setMedia(JSON.stringify(data.deployment.showcase_media ?? null, null, 2));
    }).catch((err) => toast.error(String(err)));
  }, [shareID]);

  return (
    <div className="max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Share Page Settings</h1>
        <p className="text-sm text-muted-foreground">Update public share metadata.</p>
      </div>
      <div className="grid gap-4 rounded-md border bg-background p-4">
        <Input value={deploymentID} disabled />
        <Textarea className="min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <Textarea className="min-h-40 font-mono text-xs" value={media} onChange={(e) => setMedia(e.target.value)} placeholder="Showcase media JSON" />
        <Button className="w-fit" onClick={async () => {
          let showcase_media = null;
          try {
            showcase_media = media.trim() ? JSON.parse(media) : null;
          } catch {
            toast.error("Invalid showcase media JSON");
            return;
          }
          await api(`/api/share/${deploymentID}/settings`, { method: "PATCH", body: JSON.stringify({ description, showcase_media }) });
          toast.success("Info Updated");
        }}>Save</Button>
      </div>
    </div>
  );
}
