export function MediaWatermark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`pointer-events-none absolute bottom-2 end-2 z-10 select-none font-black text-white/55 drop-shadow-md ${compact ? "text-[0.5rem]" : "text-[0.65rem]"}`}>
      Mansour Almail Scores
    </span>
  );
}