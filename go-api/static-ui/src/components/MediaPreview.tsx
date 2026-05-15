export type MediaItem = {
  url?: string;
  filename?: string;
  name?: string;
  type?: string;
  mime_type?: string;
  width?: number;
  height?: number;
};

function mediaUrl(item: MediaItem, runID?: string) {
  if (item.url) return item.url;
  const filename = item.filename || item.name;
  if (!filename || !runID) return "";
  return `/api/view?file=${encodeURIComponent(`outputs/runs/${runID}/${filename}`)}`;
}

function mediaPath(value: string) {
  return value.split("?")[0].split("#")[0].toLowerCase();
}

function mediaName(item: MediaItem, url: string) {
  return item.filename || item.name || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "output");
}

function itemType(item: MediaItem, url: string) {
  const explicit = `${item.mime_type || item.type || ""}`.toLowerCase();
  const path = mediaPath(url || item.filename || item.name || "");
  if (explicit.startsWith("image/")) return "image";
  if (explicit.startsWith("video/")) return "video";
  if (explicit.startsWith("audio/")) return "audio";
  if (explicit === "application/pdf") return "pdf";
  if (explicit.startsWith("text/")) return "text";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".svg"].some((ext) => path.endsWith(ext))) return "image";
  if ([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".mpeg", ".mpg"].some((ext) => path.endsWith(ext))) return "video";
  if ([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus"].some((ext) => path.endsWith(ext))) return "audio";
  if (explicit === "application/pdf" || path.endsWith(".pdf")) return "pdf";
  if (explicit.startsWith("text/") || [".txt", ".json", ".csv", ".log", ".md"].some((ext) => path.endsWith(ext))) return "text";
  return "file";
}

export function MediaPreviewGrid({ items, runID, emptyText = "No outputs.", compact = false }: { items: MediaItem[]; runID?: string; emptyText?: string; compact?: boolean }) {
  if (items.length === 0) {
    return <div className="flex min-h-[240px] items-center justify-center rounded-lg border text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className={`flex flex-wrap items-start justify-center gap-4 rounded-lg border p-4 ${compact ? "min-h-[120px]" : "min-h-[240px]"}`}>
      {items.map((item, index) => {
        const url = mediaUrl(item, runID);
        if (!url) return null;
        const name = mediaName(item, url);
        const type = itemType(item, url);
        if (type === "video") {
          return (
            <video key={`${url}-${index}`} controls preload="metadata" className={`${compact ? "max-h-[260px]" : "max-h-[370px]"} max-w-full rounded-xl object-contain`}>
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              <source src={url} type="video/quicktime" />
            </video>
          );
        }
        if (type === "audio") {
          return (
            <div key={`${url}-${index}`} className="w-full max-w-xl rounded-xl border bg-background p-4">
              <div className="mb-3 truncate text-sm font-medium">{name}</div>
              <audio className="w-full" controls preload="metadata" src={url} />
            </div>
          );
        }
        if (type === "image") {
          return <img key={`${url}-${index}`} className={`${compact ? "max-h-[260px]" : "max-h-[370px]"} max-w-full rounded-xl object-contain`} src={url} alt={name} />;
        }
        if (type === "pdf") {
          return <iframe key={`${url}-${index}`} className={`${compact ? "h-[260px]" : "h-[420px]"} w-full rounded-xl border`} src={url} title={name} />;
        }
        return (
          <a
            key={`${url}-${index}`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Open {name}
          </a>
        );
      })}
    </div>
  );
}

export function extractMediaItems(data: any): MediaItem[] {
  if (!data || typeof data !== "object") return [];
  const keys = ["images", "gifs", "videos", "video", "audio", "audios", "files", "attachments", "outputs"];
  const items: MediaItem[] = [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) items.push(...value.filter(Boolean));
    else if (value && typeof value === "object") items.push(value);
  }
  return items.filter((item) => item && typeof item === "object" && Boolean(item.url || item.filename || item.name));
}
