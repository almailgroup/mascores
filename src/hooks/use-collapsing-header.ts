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
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); };
  }, [key, distance]);
  return ref;
}