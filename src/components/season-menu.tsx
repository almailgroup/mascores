import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTx } from "@/lib/auto-translate";

/**
 * In-app season picker. `onHero` renders it for placement on a coloured
 * competition hero, where the default card styling would disappear.
 */
export function SeasonMenu({ seasons, value, onChange, footer, onHero = false, label = "Season", formatValue, renderIcon, className = "" }: {
  seasons: string[];
  value: string | null | undefined;
  onChange: (season: string) => void;
  footer?: ReactNode;
  onHero?: boolean;
  label?: string;
  formatValue?: (value: string) => string;
  renderIcon?: (value: string) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tx = useTx();
  const display = (season: string) => formatValue ? formatValue(season) : season.replace(/^(\d{2})\/(\d{2})$/, "20$1/20$2");
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="sm" aria-label={`${tx(label)}: ${value ? display(value) : tx("No season")}`}
        className={`glass-picker h-8 max-w-full shrink-0 gap-2 rounded-lg px-3 text-xs font-semibold tabular-nums hover:bg-accent/20 ${onHero ? "glass-picker--hero" : "text-foreground"} ${className}`}>
        {value && renderIcon?.(value)}
        <span dir={label === "Season" ? "ltr" : undefined} className="truncate">{value ? display(value) : tx("No season")}</span><ChevronDown className={`h-3 w-3 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="glass-picker glass-picker-menu z-[100] max-h-72 w-48 max-w-[70vw] overflow-y-auto rounded-lg p-1.5 text-popover-foreground">
      <div className="px-2.5 pb-2 pt-1 text-[0.65rem] font-semibold text-muted-foreground">{tx(label)}</div>
      {seasons.map((season) => <DropdownMenuItem key={season} onSelect={() => onChange(season)} className={`min-h-9 gap-3 rounded-md px-2.5 text-xs ${season === value ? "bg-muted font-semibold" : "font-medium"}`}>
        {renderIcon?.(season)}
        <span dir={label === "Season" ? "ltr" : undefined} className="flex-1">{display(season)}</span>{season === value && <Check className="h-3.5 w-3.5 text-foreground" />}
      </DropdownMenuItem>)}
      {seasons.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{tx("No seasons")}</p>}
      {footer && <div className="mt-1 border-t border-border pt-1" onClick={() => setOpen(false)}>{footer}</div>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
