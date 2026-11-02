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
      {items.map((item) => (
        <div key={item.to} role="tab" aria-label={label(item.labelKey)}
          className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.62rem] font-bold text-foreground">
          <item.icon className="h-5 w-5" strokeWidth={2.2} />
          <span className="truncate">{label(item.labelKey)}</span>
        </div>
      ))}
      {slot > 0 && activeIndex >= 0 && (() => {
        const grow = pressed ? 10 : 0;
        const left = lensX - grow;
        const right = width - lensX - slot - grow;
        const ease = drag?.moved ? "90ms ease-out" : "420ms cubic-bezier(.34,1.56,.64,1)";
        return (
          <>
            {/* Tinted, magnified copy of the tabs visible only through the lens */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10"
              style={{ clipPath: `inset(${pad - grow}px ${right}px ${pad - grow}px ${left}px round 9999px)`, transition: `clip-path ${ease}` }}>
              <div className="flex h-full items-center text-primary"
                style={{ padding: pad, transform: `scale(${pressed ? 1.14 : 1})`, transformOrigin: `${lensX + slot / 2}px 50%`, transition: `transform ${ease}` }}>
                {items.map((item) => (
                  <div key={item.to} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.62rem] font-bold">
                    <item.icon className="h-5 w-5" strokeWidth={2.4} />
                    <span className="truncate">{label(item.labelKey)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* The glass bubble itself */}
            <div aria-hidden className={`mas-glass-lens pointer-events-none absolute z-20 rounded-full ${pressed ? "is-pressed" : ""}`}
              style={{ top: pad - grow, bottom: pad - grow, left, width: slot + grow * 2, transition: `left ${ease}, top ${ease}, bottom ${ease}, width ${ease}, background-color 200ms, box-shadow 200ms` }} />
          </>
        );
      })()}
    </div>
  );
}
