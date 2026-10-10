import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Escape the browsing page's stacking context and lock background scrolling. */
export function TicketOverlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(<div data-no-gesture>{children}</div>, document.body);
}