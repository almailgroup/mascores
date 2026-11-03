import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Crown, Trophy, X } from "lucide-react";
import { supabase } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNum, useTx } from "@/lib/auto-translate";

type Row = { id: string; season: string; team_id: string; team: { id: string; name: string; logo_url: string | null } | null };

export function CompetitionTitleHistory({ competitionId }: { competitionId: string }) {
  const tx = useTx();
  const num = useNum();
  const history = useQuery({ queryKey: ["competition-title-history", competitionId], queryFn: async () => {
    const { data, error } = await supabase.from("competition_title_history").select("id,season,team_id,team:teams(id,name,logo_url)").eq("competition_id", competitionId).order("season", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Row[];
  }});
  const rows = history.data ?? [];

  const leaders = useMemo(() => {
    const map = new Map<string, { team: Row["team"]; id: string; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.team_id) ?? { team: r.team, id: r.team_id, count: 0 };
      cur.count += 1; map.set(r.team_id, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  const decades = useMemo(() => {
    const groups: { label: string; items: Row[] }[] = [];
    for (const r of rows) {
      const y = Number(r.season.slice(0, 4));
      const label = Number.isFinite(y) ? `${Math.floor(y / 10) * 10}s` : "—";
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(r); else groups.push({ label, items: [r] });
    }
    return groups;
  }, [rows]);

  // Running tally so every season shows which title number it was for that club.
  const titleNumber = useMemo(() => {
    const out = new Map<string, number>(); const seen = new Map<string, number>();
    for (const r of [...rows].reverse()) { const n = (seen.get(r.team_id) ?? 0) + 1; seen.set(r.team_id, n); out.set(r.id, n); }
    return out;
  }, [rows]);

  const latest = rows[0];
  const top = leaders.slice(0, 4);

  if (!history.isLoading && !rows.length) return null;

  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="group relative w-full overflow-hidden rounded-3xl border border-border bg-card p-4 text-start shadow-sm transition active:scale-[0.99]">
        <div aria-hidden className="pointer-events-none absolute -end-10 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Trophy className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{tx("Title history")}</div>
            <div className="mt-0.5 truncate text-lg font-black leading-tight">{latest ? tx(latest.team?.name) : "—"}</div>
            {latest && <div className="text-xs font-semibold text-muted-foreground">{tx("Champions")} · {num(latest.season)}</div>}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180" />
        </div>
        {top.length > 0 && <div className="relative mt-4 flex items-center gap-2">
          {top.map((l, i) => <div key={l.id} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl bg-muted/60 px-2 py-1.5">
            <TeamCrest name={l.team?.name} logo={l.team?.logo_url} className="h-5 w-5 shrink-0" />
            <span className={`text-sm font-black tabular-nums ${i === 0 ? "text-primary" : ""}`}>{num(l.count)}</span>
          </div>)}
        </div>}
      </button>
    </DialogTrigger>

    <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border-border p-0 [&>button:last-child]:hidden">
      <div className="relative overflow-hidden border-b border-border px-5 pb-4 pt-5">
        <div aria-hidden className="pointer-events-none absolute -start-16 -top-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{num(rows.length)} {tx("seasons")}</div>
            <DialogTitle className="mt-1 text-2xl font-black leading-none">{tx("Title history")}</DialogTitle>
          </div>
          <DialogClose className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground transition active:scale-95" aria-label={tx("Close")}><X className="h-4 w-4" /></DialogClose>
        </div>
        <div className="relative -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {leaders.map((l, i) => <Link key={l.id} to="/teams/$id" params={{ id: l.id }} className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 ${i === 0 ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>
            {i === 0 && <Crown className="h-3.5 w-3.5 text-primary" />}
            <TeamCrest name={l.team?.name} logo={l.team?.logo_url} className="h-6 w-6" />
            <span className="text-base font-black tabular-nums">{num(l.count)}</span>
          </Link>)}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {decades.map((g) => <section key={g.label}>
          <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">{num(g.label)}</div>
          <ol className="relative ms-3 border-s border-border">
            {g.items.map((r) => <li key={r.id} className="relative ps-5">
              <span aria-hidden className="absolute -start-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
              <Link to="/teams/$id" params={{ id: r.team_id }} className="my-1 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-accent active:scale-[0.99]">
                <TeamCrest name={r.team?.name} logo={r.team?.logo_url} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{tx(r.team?.name)}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">{num(r.season)}</div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-black tabular-nums text-muted-foreground">#{num(titleNumber.get(r.id) ?? 1)}</span>
              </Link>
            </li>)}
          </ol>
        </section>)}
      </div>
    </DialogContent>
  </Dialog>;
}
