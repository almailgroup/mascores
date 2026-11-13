import { useEffect, useRef } from "react";

/** One scroll signal for the identity header and its persistent navigation. */
export function useCollapsingHeader(key: string, distance = 160) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.style.setProperty("--collapse", String(Math.min(1, Math.max(0, window.scrollY / distance))));
    };
    const scroll = () => { if (header.dataset.preserveCollapse === "true") return; if (!frame) frame = requestAnimationFrame(update); };
    const release = () => { delete header.dataset.preserveCollapse; };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); window.removeEventListener("touchstart", release); window.removeEventListener("wheel", release); };
  }, [key, distance]);
  return ref;
}