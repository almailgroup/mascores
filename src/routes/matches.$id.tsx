import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, STATUS_LABELS, type Match, type Team, type MatchEvent, type Lineup, type Player } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/matches/$id")({
  head: ({ params }) => ({ meta: [{ title: `Match — MansourAlmailScores` }, { name: "description", content: `Match center ${params.id}` }] }),
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useParams();
  useRealtime(["matches", "match_events", "match_lineups"]);
  const m = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), competition:competition_id(name,slug)")
        .eq("id", id).maybeSingle();
      return data as (Match & { home: Team | null; away: Team | null; competition: { name: string; slug: string } | null }) | null;
    },
  });
  const events = useQuery({
    queryKey: ["match-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events")
        .select("*, player:player_id(id,name), team:team_id(id,name)")
        .eq("match_id", id).order("minute").order("extra");
      return (data ?? []) as unknown as (MatchEvent & { player: Player | null; team: Team | null })[];
    },
  });
  const lineups = useQuery({
    queryKey: ["match-lineups", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups")
        .select("*, player:player_id(id,name,shirt_number,position)")
        .eq("match_id", id);
      return (data ?? []) as unknown as (Lineup & { player: Player | null })[];
    },
  });

  if (m.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!m.data) return <AppShell><EmptyState title="Match not found" /></AppShell>;
  const match = m.data;
  const isLive = ["live", "ht"].includes(match.status);

  return (
    <AppShell>
      <div className="mb-6 rounded-3xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{match.competition?.name}{match.round ? ` · ${match.round}` : ""}</div>
        <div className="mt-4 grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="text-right">
            {match.home?.logo_url && <img src={match.home.logo_url} className="ml-auto h-14 w-14 object-contain" alt="" />}
            <div className="mt-2 text-lg font-bold">{match.home?.name ?? "TBD"}</div>
          </div>
          <div className="text-center">
            {["scheduled"].includes(match.status) ? (
              <div className="text-sm font-medium text-muted-foreground">{formatKickoff(match.kickoff_at)}</div>
            ) : (
              <div>
                <div className="text-4xl font-black tabular-nums">{match.home_score ?? 0} – {match.away_score ?? 0}</div>
                {match.status === "pen" && match.home_pen != null && match.away_pen != null && (
                  <div className="text-xs text-muted-foreground">({match.home_pen}–{match.away_pen} pens)</div>
                )}
              </div>
            )}
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
              {STATUS_LABELS[match.status] ?? match.status}
              {match.status === "live" && match.live_minute ? ` · ${match.live_minute}'` : ""}
            </div>
          </div>
          <div>
            {match.away?.logo_url && <img src={match.away.logo_url} className="h-14 w-14 object-contain" alt="" />}
            <div className="mt-2 text-lg font-bold">{match.away?.name ?? "TBD"}</div>
          </div>
        </div>
        {match.venue && <div className="mt-4 text-center text-xs text-muted-foreground">{match.venue}{match.city ? ` · ${match.city}` : ""}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Timeline</div>
          {events.data && events.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {events.data.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{e.minute ?? "-"}{e.extra ? `+${e.extra}` : ""}'</span>
                  <span className="inline-flex items-center gap-1"><EventIcon type={e.type} /> <span>{e.player?.name ?? e.description ?? e.type}</span></span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.team?.name}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-muted-foreground">No events yet.</div>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Lineups</div>
          {lineups.data && lineups.data.length > 0 ? (
            <div className="space-y-1 text-sm">
              {lineups.data.map((lu) => (
                <div key={lu.id} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-muted-foreground">{lu.shirt_number ?? lu.player?.shirt_number ?? ""}</span>
                  <span className={lu.is_starting ? "font-medium" : "text-muted-foreground"}>{lu.player?.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{lu.position_code ?? lu.player?.position}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-muted-foreground">No lineups posted.</div>}
        </div>
      </div>
    </AppShell>
  );
}

function EventIcon({ type }: { type: string }) {
  const map: Record<string, string> = { goal: "⚽", own_goal: "⚽", penalty: "⚽", missed_penalty: "❌", yellow: "🟨", red: "🟥", second_yellow: "🟨🟥", sub: "🔁" };
  return <span>{map[type] ?? "•"}</span>;
}