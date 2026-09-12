/**
 * Site watermark laid over a whole picture: the MA mark plus the site name,
 * in a light or dark tone so it stays readable on any photo.
 */
export function MediaWatermark({ compact = false, tone = "light" }: { compact?: boolean; tone?: "light" | "dark" }) {
  const color = tone === "dark" ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.34)";
  const shadow = tone === "dark" ? "0 1px 2px rgba(255,255,255,0.25)" : "0 1px 3px rgba(0,0,0,0.35)";
  return (
    <span className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
      {/* Big mark across the middle of the picture. */}
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 font-black tracking-tight ${compact ? "text-2xl" : "text-5xl sm:text-6xl"}`}
        style={{ color, textShadow: shadow }}
      >
        MA
      </span>
      {/* Full name along the bottom edge. */}
      <span
        className={`absolute bottom-1.5 end-2 font-black ${compact ? "text-[0.5rem]" : "text-[0.7rem]"}`}
        style={{ color, textShadow: shadow }}
      >
        Mansour Almail Scores
      </span>
    </span>
  );
}
