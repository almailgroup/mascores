import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";

/**
 * In-app season picker. `onHero` renders it for placement on a coloured
 * competition hero, where the default card styling would disappear.
 */
export function SeasonMenu({ seasons, value, onChange, footer, onHero = false }: {
  seasons: string[];
  value: string | null | undefined;
  onChange: (season: string) => void;
  footer?: ReactNode;
  onHero?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div ref={root} className="relative z-[60] shrink-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm transition ${onHero ? "border border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/25" : "border border-border bg-background text-foreground hover:border-primary/50"}`}>
      <CalendarDays className={`h-3.5 w-3.5 ${onHero ? "" : "text-primary"}`} />{value || "No season"}<ChevronDown className="h-3.5 w-3.5 opacity-70" />
    </button>
    {open && <div role="listbox" className="absolute end-0 z-[70] mt-2 max-h-72 min-w-48 overflow-y-auto rounded-xl border border-border bg-card p-1 text-foreground shadow-2xl">
      {seasons.map((season) => <button key={season} type="button" role="option" aria-selected={season === value} onClick={() => { onChange(season); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-semibold hover:bg-accent">
        <span className="flex-1">{season}</span>{season === value && <Check className="h-4 w-4 text-primary" />}
      </button>)}
      {seasons.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No seasons</p>}
      {footer && <div className="mt-1 border-t border-border pt-1" onClick={() => setOpen(false)}>{footer}</div>}
    </div>}
  </div>;
}
