type MediaItem = {
  url?: string;
  filename?: string;
  width?: number;
  height?: number;
};

function mediaUrl(item: MediaItem, runID?: string) {
  if (item.url) return item.url;
  if (!item.filename || !runID) return "";
  return `/api/view?file=${encodeURIComponent(`outputs/runs/${runID}/${item.filename}`)}`;
}

function isVideo(url: string) {
  return url.endsWith(".mp4") || url.endsWith(".webm");
}

function isImage(url: string) {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => url.endsWith(ext));
}

export function MediaPreviewGrid({ items, runID, emptyText = "No outputs." }: { items: MediaItem[]; runID?: string; emptyText?: string }) {
  if (items.length === 0) {
    return <div className="flex min-h-[240px] items-center justify-center rounded-lg border text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="flex min-h-[240px] flex-wrap items-start justify-center gap-4 rounded-lg border p-4">
      {items.map((item, index) => {
        const url = mediaUrl(item, runID);
        if (!url) return null;
        if (isVideo(url)) {
          return (
            <video key={`${url}-${index}`} controls autoPlay className="max-h-[370px] rounded-xl object-contain">
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
            </video>
          );
        }
        if (isImage(url)) {
          return <img key={`${url}-${index}`} className="max-h-[370px] rounded-xl object-contain" src={url} alt={item.filename ?? "Generated output"} />;
        }
        return (
          <a
            key={`${url}-${index}`}
            className="rounded-md border px-3 py-2 text-sm hover:underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {item.filename ?? url}
          </a>
        );
      })}
    </div>
  );
}

export function extractMediaItems(data: any): MediaItem[] {
  if (!data || typeof data !== "object") return [];
  const images = Array.isArray(data.images) ? data.images : [];
  const gifs = Array.isArray(data.gifs) ? data.gifs : [];
  const files = Array.isArray(data.files) ? data.files : [];
  return [...images, ...gifs, ...files].filter(Boolean);
}
