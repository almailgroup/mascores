import { User } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { portraitSource } from "@/lib/portrait-source";

const PortraitBatch = createContext<{ ready: boolean; photos: Record<string, string | null> } | null>(null);

/** Resolve the entire lineup before revealing any portrait, including original fallbacks. */
export function LineupPortraits({ sources, children, ready = true }: { sources: (string | null | undefined)[]; children: ReactNode; ready?: boolean }) {
  const key = JSON.stringify([...new Set(sources.filter((s): s is string => Boolean(s)))].sort());
  const [batch, setBatch] = useState<{ key: string; photos: Record<string, string | null> } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const photos: Record<string, string | null> = {};
    const images: HTMLImageElement[] = [];
    const urls: string[] = JSON.parse(key);
    const finish = () => { if (active) setBatch({ key, photos: { ...photos } }); };
    const timer = window.setTimeout(() => { finish(); active = false; }, 20000);
    Promise.all(urls.map((url) => new Promise<void>((resolve) => {
      const img = new Image();
      images.push(img);
      let original = false;
      img.onload = async () => {
        // A network-complete image may still be decoding; reveal only after pixels are ready.
        try { await img.decode(); } catch { /* Loaded images remain usable without decode support. */ }
        photos[url] = img.src; resolve();
      };
      img.onerror = () => {
        if (!original && portraitSource(url) !== url) { original = true; img.src = url; }
        else { photos[url] = null; resolve(); }
      };
      img.src = portraitSource(url) ?? url;
    }))).then(() => { if (active) { window.clearTimeout(timer); finish(); } });
    return () => { active = false; window.clearTimeout(timer); images.forEach((img) => { img.onload = null; img.onerror = null; }); };
  }, [key, ready]);
  return <PortraitBatch.Provider value={{ ready: ready && batch?.key === key, photos: ready && batch?.key === key ? batch.photos : {} }}>{children}</PortraitBatch.Provider>;
}

const SIZES = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-24 w-24" } as const;
const ICONS = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-12 w-12" } as const;

/** Player photo with a person icon fallback (never a bare question mark). */
export function PlayerAvatar({ src, name, size = "sm", className = "" }: { src?: string | null; name?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const batch = useContext(PortraitBatch);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [failedOptimizedSrc, setFailedOptimizedSrc] = useState<string | null>(null);
  const resolvedSrc = batch ? (src ? batch.photos[src] : null) : src === failedOptimizedSrc ? src : portraitSource(src);
  const hasPhoto = Boolean(src && src !== failedSrc && (!batch || resolvedSrc));
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${SIZES[size]} ${className}`}>
      {batch && !batch.ready && <span className="absolute inset-0 animate-pulse rounded-full bg-muted" />}
      <span className={`flex h-full w-full items-center justify-center transition-opacity duration-500 motion-reduce:transition-none ${batch && !batch.ready ? "opacity-0" : "opacity-100"}`}>
      {hasPhoto ? <img src={resolvedSrc ?? undefined} alt={name ?? ""} width={size === "lg" ? 96 : 56} height={size === "lg" ? 96 : 56} loading={batch || size === "lg" ? "eager" : "lazy"} fetchPriority={size === "lg" ? "high" : "auto"} decoding="async" draggable={false} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onError={() => { if (resolvedSrc !== src) setFailedOptimizedSrc(src ?? null); else setFailedSrc(src ?? null); }} className="pointer-events-none h-full w-full object-cover" /> : <User aria-label={name ?? "Player"} className={`${ICONS[size]} text-muted-foreground`} />}
      </span>
    </div>
  );
}
