import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

let previousPage: HTMLElement | null = null;

/** Interactive gestures: navigation happens only after a completed drag is released. */
export function BrowseGestures() {
  const router = useRouter();
  const location = useLocation();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const busy = useRef(false);
  useLayoutEffect(() => {
    const surface = document.querySelector<HTMLElement>("[data-browse-surface]");
    const capture = () => {
      if (!surface) return;
      const copy = surface.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[data-gesture-ui]").forEach((node) => node.remove());
      copy.removeAttribute("data-browse-surface");
      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      copy.style.transform = `translateY(${-window.scrollY}px)`;
      copy.style.transition = "none";
      copy.inert = true;
      previousPage = copy;
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) capture();
    };
    document.addEventListener("pointerdown", onClick, true);
    return () => { document.removeEventListener("pointerdown", onClick, true); };
  }, [location.pathname]);

  useEffect(() => {
    const surface = document.querySelector<HTMLElement>("[data-browse-surface]");
    // Move the entire browsing page, including its header, but not the fixed tab bar.
    const content = document.querySelector<HTMLElement>("[data-browse-page]");
    if (!surface || !content) return;
    // Identity headers remain stationary on these pages; only their body opens below.
    let refreshContent = content.querySelector<HTMLElement>("[data-refresh-body]") ?? content;
    let refreshHeader = content.querySelector<HTMLElement>("[data-refresh-header]");
    let start: { x: number; y: number; edge: boolean; top: boolean } | null = null;
    let distance = 0;
    let axis: "back" | "refresh" | null = null;
    let underlay: HTMLDivElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reset = () => {
      timer = null;
      surface.style.transform = "";
      surface.style.transition = "";
      surface.style.boxShadow = "";
      content.style.transform = "";
      content.style.transition = "";
      refreshContent.style.transform = "";
      refreshContent.style.transition = "";
      document.documentElement.style.overscrollBehaviorY = "";
      underlay?.remove(); underlay = null;
      setPull(0);
    };
    const settle = () => {
      // A transform on the shell makes fixed navigation relative to the page.
      // Only animate elements that actually moved, never ordinary scrolls/taps.
      if (surface.style.transform) {
        surface.style.transition = reduced ? "none" : "transform 240ms cubic-bezier(.2,.8,.2,1)";
        surface.style.transform = "";
      }
      if (refreshContent.style.transform) {
        refreshContent.style.transition = reduced ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)";
        refreshContent.style.transform = "";
      }
      setPull(0);
      timer = setTimeout(reset, reduced ? 0 : 280);
    };
    const onStart = (event: TouchEvent) => {
      start = null; axis = null; distance = 0;
      if (busy.current || timer) return;
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || target?.closest('input,textarea,select,[role="dialog"],[data-no-gesture]')) return;
      for (let node = target; node && node !== document.body; node = node.parentElement) {
        const css = getComputedStyle(node);
        if ((/auto|scroll/.test(css.overflowY) && node.scrollHeight > node.clientHeight) || (/auto|scroll/.test(css.overflowX) && node.scrollWidth > node.clientWidth)) return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      refreshContent = content.querySelector<HTMLElement>("[data-refresh-body]") ?? content;
      refreshHeader = content.querySelector<HTMLElement>("[data-refresh-header]");
      start = { x: touch.clientX, y: touch.clientY, edge: touch.clientX <= 28 && router.history.canGoBack(), top: window.scrollY <= 0 };
      setIndicatorTop(refreshHeader?.getBoundingClientRect().bottom ?? document.querySelector("[data-shell-header]")?.getBoundingClientRect().bottom ?? 0);
      distance = 0; axis = null;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch || busy.current) return;
      const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
      if (!axis) {
        if (start.edge && dx > 8 && dx > Math.abs(dy) * 1.5) axis = "back";
        else if (start.top && dy > 8 && dy > Math.abs(dx) * 1.5) axis = "refresh";
        else if (Math.abs(dy) > 12 || Math.abs(dx) > 12) { start = null; return; }
      }
      if (!axis) return;
      if (event.cancelable) event.preventDefault();
      document.documentElement.style.overscrollBehaviorY = "none";
      if (axis === "back") {
        distance = Math.max(0, Math.min(window.innerWidth, dx));
        if (!underlay) {
          underlay = document.createElement("div");
          underlay.className = "browse-back-underlay";
          underlay.setAttribute("aria-hidden", "true");
          if (previousPage) underlay.append(previousPage.cloneNode(true));
          document.body.append(underlay);
          surface.style.boxShadow = "-8px 0 24px var(--border)";
        }
        surface.style.transition = "none";
        surface.style.transform = `translateX(${distance}px)`;
        underlay.style.transform = `translateX(${-Math.max(0, window.innerWidth - distance) * 0.22}px)`;
      } else {
        distance = Math.max(0, dy);
        const offset = 110 * (1 - Math.exp(-distance / 230));
        refreshContent.style.transition = "none";
        refreshContent.style.transform = `translateY(${offset}px)`;
        setPull(offset);
      }
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      if (!axis) return;
      if (axis === "back" && distance >= window.innerWidth * 0.34) {
        busy.current = true;
        surface.style.transition = reduced ? "none" : "transform 200ms ease-out";
        surface.style.transform = `translateX(${window.innerWidth}px)`;
        if (underlay) { underlay.style.transition = "transform 200ms ease-out"; underlay.style.transform = "translateX(0px)"; }
        timer = setTimeout(() => { reset(); timer = null; busy.current = false; router.history.back(); }, reduced ? 0 : 200);
      } else if (axis === "refresh" && distance >= 180) {
        busy.current = true; setRefreshing(true); setPull(64);
        refreshContent.style.transition = "transform 180ms ease-out";
        refreshContent.style.transform = "translateY(64px)";
        void Promise.all([qc.invalidateQueries(), router.invalidate(), new Promise((resolve) => setTimeout(resolve, 500))]).catch(() => {}).finally(() => {
          busy.current = false; setRefreshing(false); settle();
        });
      } else settle();
      axis = null; distance = 0;
    };
    const cancel = () => { const moved = axis !== null; start = null; axis = null; distance = 0; if (moved) settle(); };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", cancel);
    // Clear transition locks once the spring completes.
    const transitionEnd = () => { if (!busy.current && timer) { clearTimeout(timer); timer = null; reset(); } };
    surface.addEventListener("transitionend", transitionEnd); content.addEventListener("transitionend", transitionEnd);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("touchstart", onStart); document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd); document.removeEventListener("touchcancel", cancel);
      surface.removeEventListener("transitionend", transitionEnd); content.removeEventListener("transitionend", transitionEnd);
      reset(); busy.current = false;
    };
  }, [router, qc, location.pathname]);
  if (!pull && !refreshing) return null;
  return <div data-gesture-ui role="status" aria-label={refreshing ? "Refreshing" : "Pull to refresh"} className="browse-refresh-indicator pointer-events-none fixed inset-x-0 z-20 flex justify-center" style={{ top: indicatorTop, height: refreshing ? 64 : pull }}><Loader2 className={`h-5 w-5 self-center text-muted-foreground ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 40) }} /></div>;
}
