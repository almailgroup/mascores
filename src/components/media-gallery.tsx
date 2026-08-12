import { ExternalLink } from "lucide-react";

/** YouTube video id from any common share/watch/shorts link. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) || /\/storage\/v1\/object\//.test(url);
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Renders a mixed list of links: photos inline, YouTube embedded, everything else as a link card. */
export function MediaGallery({ urls, className = "" }: { urls: string[]; className?: string }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {urls.map((url) => {
        const yt = youtubeId(url);
        if (yt) {
          return (
            <div key={url} className="overflow-hidden rounded-2xl border border-border bg-black">
              <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${yt}`} title="Video" loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          );
        }
        if (isImageUrl(url)) {
          return <img key={url} src={url} alt="" loading="lazy" className="h-48 w-full rounded-2xl border border-border object-cover" />;
        }
        return (
          <a key={url} href={url} target="_blank" rel="noreferrer"
            className="flex h-48 flex-col justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-primary">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{host(url)}</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">Open media <ExternalLink className="h-4 w-4" /></span>
          </a>
        );
      })}
    </div>
  );
}
