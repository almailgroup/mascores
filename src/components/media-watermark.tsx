/**
 * Small site credit placed in the corner of a picture, so photos stay clear of
 * faces while still carrying the MA Scores name.
 */
export function MediaWatermark({ compact = false, tone = "light" }: { compact?: boolean; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <span
      className={`pointer-events-none absolute bottom-1.5 end-1.5 z-10 flex select-none items-center gap-1 rounded-full px-1.5 py-0.5 font-black backdrop-blur-[2px] ${compact ? "text-[0.5rem]" : "text-[0.65rem]"}`}
      style={{
        color: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
        background: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)",
      }}
    >
      <span className="tracking-tight">MA</span>
      {!compact && <span className="font-bold tracking-tight">Mansour Almail Scores</span>}
    </span>
  );
}
