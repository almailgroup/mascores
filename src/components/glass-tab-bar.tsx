import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentType } from "react";

type Item = { to: string; labelKey: string; exact?: boolean; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

/**
 * iOS-style liquid glass tab bar: hold the bar and slide, a magnified glass lens
 * follows the finger and the tab under it opens on release. Taps still work.
 */
export function GlassTabBar({ items, activeIndex, label, onReselect }: {
  items: Item[];
  activeIndex: number;
  label: (key: string) => string;
  onReselect: (item: Item) => void;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<{ x: number; startX: number; moved: boolean } | null>(null);
  const [pressed, setPressed] = useState(false);
  const pad = 6;
  const count = items.length;

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slot = width ? (width - pad * 2) / count : 0;
  const clampIndex = (i: number) => Math.max(0, Math.min(count - 1, i));
  const indexAt = (x: number) => clampIndex(Math.floor((x - pad) / (slot || 1)));
  const localX = (clientX: number) => clientX - (barRef.current?.getBoundingClientRect().left ?? 0);

  const lensX = drag?.moved
    ? Math.max(pad, Math.min(width - pad - slot, drag.x - slot / 2))
    : pad + Math.max(activeIndex, 0) * slot;
  const hoverIndex = drag?.moved ? indexAt(drag.x) : activeIndex;

  const go = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (i === activeIndex) onReselect(item);
    else void router.navigate({ to: item.to });
  };

  return (
    <div
      ref={barRef}
      role="tablist"
      className="pointer-events-auto relative mx-auto flex max-w-md touch-none select-none items-center rounded-full border border-border/50 bg-background/60 shadow-[0_10px_36px_-10px_hsl(0_0%_0%/0.45)] backdrop-blur-2xl backdrop-saturate-150"
      style={{ padding: pad, WebkitTouchCallout: "none" }}
      onPointerDown={(e) => {
        barRef.current?.setPointerCapture(e.pointerId);
        const x = localX(e.clientX);
        setPressed(true);
        setDrag({ x, startX: x, moved: false });
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const x = localX(e.clientX);
        setDrag({ ...drag, x, moved: drag.moved || Math.abs(x - drag.startX) > 6 });
      }}
      onPointerUp={(e) => {
        if (!drag) return;
        const i = indexAt(localX(e.clientX));
        setDrag(null);
        setPressed(false);
        go(i);
      }}
      onPointerCancel={() => { setDrag(null); setPressed(false); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {slot > 0 && activeIndex >= 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full border border-foreground/10 bg-foreground/10 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25),0_4px_14px_-6px_hsl(0_0%_0%/0.4)] backdrop-blur-md"
          style={{
            top: pad,
            bottom: pad,
            width: slot,
            transform: `translateX(${lensX - pad}px) scale(${pressed ? 1.18 : 1}, ${pressed ? 1.12 : 1})`,
            left: pad,
            transition: drag?.moved ? "transform 90ms ease-out" : "transform 380ms cubic-bezier(.34,1.56,.64,1)",
          }}
        />
      )}
      {items.map((item, i) => {
        const on = i === hoverIndex;
        return (
          <div key={item.to} role="tab" aria-selected={i === activeIndex} aria-label={label(item.labelKey)}
            className={`relative z-10 flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.62rem] font-semibold transition-[color,transform] duration-200 ${on ? "text-primary" : "text-foreground/80"}`}
            style={{ transform: on && pressed ? "scale(1.1)" : "scale(1)" }}>
            <item.icon className="h-5 w-5" strokeWidth={on ? 2.4 : 2} />
            <span className="truncate">{label(item.labelKey)}</span>
          </div>
        );
      })}
    </div>
  );
}
