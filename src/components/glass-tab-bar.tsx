import { useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, type ComponentType } from "react";

type Item = { to: string; labelKey: string; exact?: boolean; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

const PAD = 6;
const GROW_X = 18; // how far the bubble swells sideways while held
const GROW_Y = 14; // how far it swells above/below the bar
const SPRING = "cubic-bezier(.34,1.56,.64,1)";

/**
 * iOS-style liquid glass tab bar. Dragging updates styles directly on the GPU
 * (transform/clip-path) without React re-renders so sliding stays smooth.
 */
export function GlassTabBar({ items, activeIndex, label, onReselect }: {
  items: Item[];
  activeIndex: number;
  label: (key: string) => string;
  onReselect: (item: Item) => void;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const st = useRef({ width: 0, left: 0, dragging: false, moved: false, startX: 0, x: 0, raf: 0 });
  const count = items.length;

  const slot = () => (st.current.width - PAD * 2) / count;
  const indexAt = (x: number) => Math.max(0, Math.min(count - 1, Math.floor((x - PAD) / (slot() || 1))));

  const paint = (animate: boolean) => {
    const s = st.current;
    const lens = lensRef.current, clip = clipRef.current, inner = innerRef.current;
    if (!lens || !clip || !inner || !s.width || activeIndex < 0) return;
    const w = slot();
    const pressed = s.dragging;
    const gx = pressed ? GROW_X : 0, gy = pressed ? GROW_Y : 0;
    const base = s.moved ? Math.max(PAD, Math.min(s.width - PAD - w, s.x - w / 2)) : PAD + activeIndex * w;
    const left = base - gx, width = w + gx * 2;
    const t = animate ? `420ms ${SPRING}` : "0ms";
    for (const el of [lens, clip, inner]) el.style.transitionDuration = animate ? "420ms" : "0ms";
    lens.style.transition = `transform ${t}, background-color 200ms, box-shadow 200ms`;
    lens.style.width = `${w}px`;
    lens.style.transform = `translate3d(${base}px,0,0) scale(${width / w}, ${(s.height + gy * 2) / s.height})`;
    lens.classList.toggle("is-pressed", pressed);
    clip.style.transition = `clip-path ${t}`;
    clip.style.clipPath = `inset(${PAD - gy}px ${s.width - left - width}px ${PAD - gy}px ${left}px round 9999px)`;
    inner.style.transition = `transform ${t}`;
    inner.style.transformOrigin = `${base + w / 2}px 50%`;
    inner.style.transform = `scale(${pressed ? 1.18 : 1})`;
  };

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      st.current.width = el.clientWidth;
      st.current.height = el.clientHeight - PAD * 2;
      paint(false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => { paint(true); }); // re-snap after route change

  const go = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (i === activeIndex) onReselect(item);
    else void router.navigate({ to: item.to });
  };

  const renderTabs = (tinted: boolean) => items.map((item) => (
    <div key={item.to} {...(!tinted ? { role: "tab", "aria-selected": items.indexOf(item) === activeIndex, "aria-label": label(item.labelKey) } : {})}
      className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.62rem] font-bold">
      <item.icon className="h-5 w-5" strokeWidth={tinted ? 2.4 : 2.2} />
      <span className="truncate">{label(item.labelKey)}</span>
    </div>
  ));

  return (
    <div
      ref={barRef}
      role="tablist"
      className="pointer-events-auto relative mx-auto flex max-w-md touch-none select-none items-center rounded-full border border-border/50 bg-background/45 text-foreground shadow-[0_10px_36px_-10px_hsl(0_0%_0%/0.45)] backdrop-blur-xl backdrop-saturate-150"
      style={{ padding: PAD, WebkitTouchCallout: "none" }}
      onPointerDown={(e) => {
        barRef.current?.setPointerCapture(e.pointerId);
        const s = st.current;
        s.left = barRef.current?.getBoundingClientRect().left ?? 0;
        s.startX = s.x = e.clientX - s.left;
        s.dragging = true; s.moved = false;
        paint(true);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s.dragging) return;
        s.x = e.clientX - s.left;
        const wasMoved = s.moved;
        if (Math.abs(s.x - s.startX) > 6) s.moved = true;
        if (!s.moved) return;
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(() => paint(!wasMoved));
      }}
      onPointerUp={(e) => {
        const s = st.current;
        if (!s.dragging) return;
        cancelAnimationFrame(s.raf);
        const i = indexAt(e.clientX - s.left);
        s.dragging = false; s.moved = false;
        if (i === activeIndex) paint(true);
        go(i);
      }}
      onPointerCancel={() => { const s = st.current; s.dragging = false; s.moved = false; paint(true); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {renderTabs(false)}
      <div ref={clipRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 will-change-[clip-path]">
        <div ref={innerRef} className="flex h-full items-center text-primary will-change-transform" style={{ padding: PAD }}>
          {renderTabs(true)}
        </div>
      </div>
      <div ref={lensRef} aria-hidden className="mas-glass-lens pointer-events-none absolute left-0 z-20 rounded-full will-change-transform"
        style={{ top: PAD, bottom: PAD, transformOrigin: "50% 50%" }} />
    </div>
  );
}
