import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTx } from "@/lib/auto-translate";

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
  const tx = useTx();
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="sm" aria-label={`${tx("Season")}: ${value || tx("No season")}`}
        className={`h-7 shrink-0 gap-2 rounded-md border px-2.5 text-xs font-medium tabular-nums shadow-none ${onHero ? "border-border/70 bg-card/95 text-card-foreground hover:bg-muted" : "border-border bg-muted/50 text-foreground hover:bg-muted"}`}>
        <span dir="ltr">{value || tx("No season")}</span><ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={6} collisionPadding={12} className="z-[100] w-44 max-w-[70vw] rounded-lg border-border bg-popover p-1.5 text-popover-foreground">
      {seasons.map((season) => <DropdownMenuItem key={season} onSelect={() => onChange(season)} className={`min-h-9 gap-3 rounded-md px-2.5 text-xs ${season === value ? "bg-muted font-semibold" : "font-medium"}`}>
        <span dir="ltr" className="flex-1">{season}</span>{season === value && <Check className="h-3.5 w-3.5 text-foreground" />}
      </DropdownMenuItem>)}
      {seasons.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{tx("No seasons")}</p>}
      {footer && <div className="mt-1 border-t border-border pt-1" onClick={() => setOpen(false)}>{footer}</div>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
