import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Match, type Team } from "@/lib/db";
import { MatchEditor } from "./match-editor";
import { TeamCrest } from "@/components/team-crest";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

type Row = Match & { competitions: { id: string; name: string; logo_url: string | null; sort_order: number | null } | null };

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const FINISHED = new Set(["finished", "ft", "aet", "pen", "awarded", "cancelled", "postponed", "abandoned"]);
/** A match whose kickoff was over two hours ago but still has no final result saved. */
export const missingResult = (m: Pick<Match, "kickoff_at" | "status">, now = Date.now()) =>
  !!m.kickoff_at && new Date(m.kickoff_at).getTime() < now - 2 * 3600_000 && !FINISHED.has(m.status);

/** Every match from every competition, one day at a time, with missing results flagged. */
export function AllMatchesPanel() {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const teamsQ = useQuery({
    queryKey: ["admin", "all-teams-lite"],
    queryFn: async () => ((await supabase.from("teams").select("*").order("name").limit(5000)).data ?? []) as Team[],
    staleTime: 300_000,
  });
  const teamMap = useMemo(() => new Map((teamsQ.data ?? []).map((t) => [t.id, t])), [teamsQ.data]);

  const dayQ = useQuery({
    queryKey: ["admin", "all-matches-day", dayKey(day)],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*, competitions(id,name,logo_url,sort_order)")
        .gte("kickoff_at", day.toISOString()).lt("kickoff_at", addDays(day, 1).toISOString()).order("kickoff_at");
      return (data ?? []) as unknown as Row[];
    },
  });

  // Past matches still waiting for a result, across all competitions (last 120 days).
  const missingQ = useQuery({
    queryKey: ["admin", "missing-results"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("id,kickoff_at,status")
        .gte("kickoff_at", addDays(new Date(), -120).toISOString()).lt("kickoff_at", new Date(Date.now() - 2 * 3600_000).toISOString())
        .not("status", "in", `(${[...FINISHED].join(",")})`).order("kickoff_at", { ascending: false }).limit(500);
      return (data ?? []) as Pick<Match, "id" | "kickoff_at" | "status">[];
    },
  });
  const missingDays = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of missingQ.data ?? []) if (r.kickoff_at) { const k = dayKey(new Date(r.kickoff_at)); m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [missingQ.data]);

  const strip = useMemo(() => Array.from({ length: 15 }, (_, i) => addDays(day, i - 7)), [day]);
  const stripQ = useQuery({
    queryKey: ["admin", "match-days", dayKey(strip[0]), dayKey(strip[14])],
    queryFn: () => matchDaysBetween(strip[0], addDays(strip[14], 1)),
  });
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>("[data-sel='1']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [day]);

  const groups = useMemo(() => {
    const map = new Map<string, { comp: Row["competitions"]; rows: Row[] }>();
    for (const r of dayQ.data ?? []) {
      const k = r.competition_id ?? "none";
      if (!map.has(k)) map.set(k, { comp: r.competitions, rows: [] });
      map.get(k)!.rows.push(r);
    }
    return [...map.values()].sort((a, b) => (a.comp?.sort_order ?? 999) - (b.comp?.sort_order ?? 999) || (a.comp?.name ?? "").localeCompare(b.comp?.name ?? ""));
  }, [dayQ.data]);

  const totalMissing = missingQ.data?.length ?? 0;
  const close = () => { setEditing(null); dayQ.refetch(); missingQ.refetch(); };

  return (
    <div className="-mx-4 sm:mx-0">
      <div className="flex items-stretch border-b border-border">
        <div ref={stripRef} className="flex flex-1 overflow-x-auto px-2 pb-2">
          {strip.map((d) => {
            const k = dayKey(d); const sel = k === dayKey(day); const miss = missingDays.get(k);
            return (
              <button key={k} data-sel={sel ? "1" : "0"} onClick={() => setDay(d)} className="flex w-12 shrink-0 flex-col items-center gap-1 py-1">
                <span className="text-xs text-muted-foreground">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${sel ? "bg-primary text-primary-foreground" : ""}`}>{d.getDate()}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${miss ? "bg-destructive" : stripQ.data?.has(k) ? "bg-primary" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
        <button onClick={() => setCalOpen(true)} className="flex w-12 shrink-0 items-center justify-center border-s border-border" aria-label="Open calendar"><CalendarDays className="h-5 w-5" /></button>
      </div>

      {totalMissing > 0 && (
        <div className="mx-4 mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="h-4 w-4" /> {totalMissing} {totalMissing === 1 ? "match is" : "matches are"} missing a result</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...missingDays.entries()].slice(0, 12).map(([k, n]) => {
              const [y, mo, d] = k.split("-").map(Number);
              return <button key={k} onClick={() => setDay(new Date(y, mo - 1, d))} className="rounded-full border border-destructive/40 bg-card px-2.5 py-1 text-xs font-semibold">{new Date(y, mo - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {n}</button>;
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-4 text-sm">
        <span className="font-bold">{day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        <span className="text-muted-foreground">{dayQ.data?.length ?? 0} matches</span>
      </div>

      <div className="mt-3 space-y-3 px-4 pb-6">
        {dayQ.isLoading && <div className="h-24 animate-pulse rounded-2xl bg-muted" />}
        {!dayQ.isLoading && groups.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No matches on this day.</div>}
        {groups.map(({ comp, rows }) => (
          <div key={comp?.id ?? "none"} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              {comp?.logo_url ? <img src={comp.logo_url} alt="" className="h-7 w-7 object-contain" /> : <span className="h-7 w-7" />}
              <span className="truncate text-sm font-bold">{comp?.name ?? "No competition"}</span>
            </div>
            {rows.map((m) => {
              const home = teamMap.get(m.home_team_id ?? ""); const away = teamMap.get(m.away_team_id ?? "");
              const miss = missingResult(m);
              const time = m.kickoff_at ? new Date(m.kickoff_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--";
              const status = miss ? "!" : m.status === "scheduled" ? "-" : ["live", "ht"].includes(m.status) ? m.status.toUpperCase() : "FT";
              return (
                <button key={m.id} onClick={() => setEditing(m)} className={`flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-start hover:bg-accent ${miss ? "bg-destructive/5" : ""}`}>
                  <div className="w-12 shrink-0 text-center text-xs text-muted-foreground"><div>{time}</div><div className={miss ? "font-bold text-destructive" : ""}>{status}</div></div>
                  <div className="min-w-0 flex-1 space-y-1 border-s border-border ps-3">
                    {[home, away].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <TeamCrest src={t?.logo_url ?? null} name={t?.name ?? "TBD"} className="h-5 w-5" />
                        <span className="min-w-0 flex-1 truncate">{t?.name ?? "TBD"}</span>
                        <span className="font-bold tabular-nums">{i === 0 ? m.home_score ?? "" : m.away_score ?? ""}</span>
                      </div>
                    ))}
                  </div>
                  {miss && <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[0.65rem] font-bold text-destructive-foreground">Add result</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {calOpen && <MatchCalendar value={day} missingDays={missingDays} onPick={(d) => { setDay(d); setCalOpen(false); }} onClose={() => setCalOpen(false)} />}
      {editing && <MatchEditor match={editing} teams={[teamMap.get(editing.home_team_id ?? ""), teamMap.get(editing.away_team_id ?? "")].filter(Boolean) as Team[]} onClose={close} />}
    </div>
  );
}

async function matchDaysBetween(from: Date, to: Date) {
  const { data } = await supabase.from("matches").select("kickoff_at").gte("kickoff_at", from.toISOString()).lt("kickoff_at", to.toISOString()).limit(3000);
  return new Set((data ?? []).map((r) => dayKey(new Date(r.kickoff_at as string))));
}

/** The app's own month calendar (not the phone's date picker). */
function MatchCalendar({ value, missingDays, onPick, onClose }: { value: Date; missingDays: Map<string, number>; onPick: (d: Date) => void; onClose: () => void }) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const daysQ = useQuery({
    queryKey: ["admin", "match-days-month", month.getFullYear(), month.getMonth()],
    queryFn: () => matchDaysBetween(month, new Date(month.getFullYear(), month.getMonth() + 1, 1)),
  });
  const lead = (month.getDay() + 6) % 7; // Monday first
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const today = dayKey(new Date());
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5"><h3 className="text-xl font-bold">Change date</h3><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div className="flex items-center justify-between px-5 pb-3 text-primary">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
          <span className="font-bold">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 bg-muted py-2 text-center text-xs text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1 p-3 text-center">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const k = dayKey(d); const sel = k === dayKey(value);
            return (
              <button key={k} onClick={() => onPick(d)} className="flex flex-col items-center py-1">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${sel ? "bg-primary font-bold text-primary-foreground" : k === today ? "font-bold text-primary" : ""}`}>{d.getDate()}</span>
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${missingDays.has(k) ? "bg-destructive" : daysQ.data?.has(k) ? "bg-primary" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border p-4 text-xs">
          <button onClick={() => onPick(startOfDay(new Date()))} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Today</button>
          <span className="flex flex-col items-end gap-1"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Days with matches</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Missing result</span></span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
