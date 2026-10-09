import { User } from "lucide-react";
import { useState } from "react";
import { MediaWatermark } from "@/components/media-watermark";
import { portraitSource } from "@/lib/portrait-source";

const SIZES = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-24 w-24" } as const;
const ICONS = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-12 w-12" } as const;

/** Player photo with a person icon fallback (never a bare question mark). */
export function PlayerAvatar({ src, name, size = "sm", className = "" }: { src?: string | null; name?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [failedOptimizedSrc, setFailedOptimizedSrc] = useState<string | null>(null);
  const resolvedSrc = src === failedOptimizedSrc ? src : portraitSource(src);
  const hasPhoto = Boolean(src && src !== failedSrc);
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${SIZES[size]} ${className}`}>
      {hasPhoto ? <img src={resolvedSrc ?? undefined} alt={name ?? ""} width={size === "lg" ? 96 : 56} height={size === "lg" ? 96 : 56} loading={size === "lg" ? "eager" : "lazy"} fetchPriority={size === "lg" ? "high" : "auto"} decoding="async" draggable={false} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onError={() => { if (resolvedSrc !== src) setFailedOptimizedSrc(src ?? null); else setFailedSrc(src ?? null); }} className="pointer-events-none h-full w-full object-cover" /> : <User aria-label={name ?? "Player"} className={`${ICONS[size]} text-muted-foreground`} />}
      {hasPhoto && size === "lg" && <MediaWatermark compact />}
    </div>
  );
}
