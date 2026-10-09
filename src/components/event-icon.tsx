import { ArrowDownUp, Cross, MonitorCheck, MessageSquare, X, Check } from "lucide-react";
import { eventLabel } from "@/lib/db";

const TYPES = new Set(["goal", "penalty_goal", "penalty", "penalty_miss", "missed_penalty", "own_goal", "yellow", "red", "second_yellow", "substitution", "sub", "injury_sub", "injury_substitution", "var", "VAR", "note", "notes"]);
export function hasEventArt(type: string) { return TYPES.has(type); }

/** Theme-aware vector marks remain legible in timelines, headers and lineups. */
export function EventIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  const label = eventLabel(type);
  let art;
  if (["yellow", "red", "second_yellow"].includes(type)) {
    art = <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      {type === "second_yellow" ? <><rect x="3" y="3" width="12" height="16" rx="2" className="fill-warning stroke-warning-foreground" /><rect x="10" y="6" width="11" height="16" rx="2" className="fill-destructive stroke-destructive-foreground" /></> : <rect x="6" y="2" width="12" height="20" rx="2" className={type === "red" ? "fill-destructive stroke-destructive-foreground" : "fill-warning stroke-warning-foreground"} />}
    </svg>;
  } else if (["goal", "penalty_goal", "penalty", "penalty_miss", "missed_penalty", "own_goal"].includes(type)) {
    const penalty = type !== "goal";
    art = <span className="relative h-full w-full">
      <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="m12 7 5 4-2 6H9l-2-6Z" fill="currentColor" /><path d="m12 7-1-5m6 9 5-2m-7 8 3 4m-9-4-3 4m1-10L2 9" />
      </svg>
      {penalty && <span className={`absolute -bottom-1 -end-1 grid h-3 w-3 place-items-center rounded-full ${["penalty_miss", "missed_penalty", "own_goal"].includes(type) ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
        {["penalty_miss", "missed_penalty"].includes(type) ? <X className="h-2.5 w-2.5" /> : type === "own_goal" ? <span className="text-[7px] font-bold">OG</span> : <Check className="h-2.5 w-2.5" />}
      </span>}
    </span>;
  } else if (["substitution", "sub"].includes(type)) art = <ArrowDownUp className="h-full w-full text-primary" />;
  else if (["injury_sub", "injury_substitution"].includes(type)) art = <Cross className="h-full w-full text-destructive" />;
  else if (["var", "VAR"].includes(type)) art = <MonitorCheck className="h-full w-full text-primary" />;
  else art = <MessageSquare className="h-full w-full text-primary" />;
  return <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 items-center justify-center text-event-ink ${className}`}>{art}</span>;
}