import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2 } from "lucide-react";

export function BrowseGestures() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let start: { x: number; y: number; edge: boolean; top: boolean } | null = null;
    let distance = 0;
    const onStart = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || target?.closest('input,textarea,select,[role="dialog"],[data-no-gesture]')) return;
      // Leave scrollable sheets and horizontal carousels to their own gestures.
      for (let node = target; node && node !== document.body; node = node.parentElement) {
        const css = getComputedStyle(node);
        if ((/auto|scroll/.test(css.overflowY) && node.scrollHeight > node.clientHeight) || (/auto|scroll/.test(css.overflowX) && node.scrollWidth > node.clientWidth)) return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      start = { x: touch.clientX, y: touch.clientY, edge: touch.clientX <= 24, top: window.scrollY <= 0 };
      distance = 0;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch || busy.current) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (start.edge && dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (event.cancelable) event.preventDefault();
        distance = dx;
      } else if (start.top && dy > 12 && dy > Math.abs(dx) * 1.5) {
        if (event.cancelable) event.preventDefault();
        distance = dy;
        setPull(Math.min(80, dy * 0.4));
      }
    };
    const onEnd = () => {
      if (!start) return;
      const previous = start;
      start = null;
      setPull(0);
      if (previous.edge && distance > 80) {
        if (router.history.canGoBack()) router.history.back();
      } else if (previous.top && distance > 150 && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        void Promise.all([qc.invalidateQueries(), router.invalidate()]).finally(() => { busy.current = false; setRefreshing(false); });
      }
      distance = 0;
    };
    const cancel = () => { start = null; distance = 0; setPull(0); };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", cancel);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", cancel);
    };
  }, [router, qc]);
  if (!pull && !refreshing) return null;
  return <div role="status" aria-label={refreshing ? "Refreshing" : "Pull to refresh"} className="fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex justify-center pointer-events-none"><span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-primary shadow">{refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowDown className="h-5 w-5" />}</span></div>;
}