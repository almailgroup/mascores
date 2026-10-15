import { useEffect, useMemo, useRef } from "react";

type Opt = { minute: number; extra: number | null; label: string };

function buildOptions(): Opt[] {
  const out: Opt[] = [];
  const push = (m: number, e: number | null) => out.push({ minute: m, extra: e, label: e ? `${m}'+${e}` : `${m}'` });
  for (let m = 1; m <= 45; m++) push(m, null);
  for (let e = 1; e <= 15; e++) push(45, e);
  for (let m = 46; m <= 90; m++) push(m, null);
  for (let e = 1; e <= 20; e++) push(90, e);
  for (let m = 91; m <= 105; m++) push(m, null);
  for (let e = 1; e <= 5; e++) push(105, e);
  for (let m = 106; m <= 120; m++) push(m, null);
  for (let e = 1; e <= 10; e++) push(120, e);
  return out;
}

const ROW = 44;

async function tick() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch { /* fall through */ }
  try { navigator.vibrate?.(8); } catch { /* unsupported */ }
}

/** iOS-style scroll wheel for match minutes incl. added time; vibrates on every step. */
export function MinuteWheel({ minute, extra, onChange }: { minute: number | null | undefined; extra: number | null | undefined; onChange: (minute: number, extra: number | null) => void }) {
  const opts = useMemo(buildOptions, []);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(-1);
  const startIdx = Math.max(0, opts.findIndex((o) => o.minute === (minute ?? 1) && (o.extra ?? null) === (extra || null)));

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = startIdx * ROW;
    last.current = startIdx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const i = Math.min(opts.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
    if (i !== last.current) {
      last.current = i;
      void tick();
      onChange(opts[i].minute, opts[i].extra);
    }
  };

  const cur = last.current < 0 ? startIdx : last.current;
  return (
    <div className="relative mx-auto h-[132px] w-full max-w-xs" data-no-gesture>
      <div className="pointer-events-none absolute inset-x-0 top-[44px] h-[44px] rounded-full bg-muted" />
      <div ref={ref} onScroll={onScroll} className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ touchAction: "pan-y" }}>
        <div style={{ height: ROW }} />
        {opts.map((o, i) => (
          <button key={o.label} type="button" onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}
            className={`flex w-full snap-center items-center justify-center tabular-nums transition-all ${i === cur ? "text-xl font-bold text-foreground" : "text-base font-semibold text-muted-foreground/60"}`}
            style={{ height: ROW }}>{o.label}</button>
        ))}
        <div style={{ height: ROW }} />
      </div>
    </div>
  );
}
