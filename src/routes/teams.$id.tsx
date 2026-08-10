import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, type Team, type Player, type Match, type StandingRow, type Coach, type Transfer } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FavoriteButton } from "@/hooks/use-favorites";
import { FlagIcon } from "@/components/flag";
import { TeamCrest } from "@/components/team-crest";
import { useI18n } from "@/lib/i18n";
import { PlayerAvatar } from "@/components/player-avatar";
import { LinkedNews } from "@/components/linked-news";
import { ArrowRight } from "lucide-react";
import { MatchRow, type MatchWithTeams } from "@/components/match-list";
import { useDates, useNum, useTx } from "@/lib/auto-translate";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({
    meta: [
      { title: "Club — MansourAlmailScores" },
      { name: "description", content: "Club profile: matches, standings, squad, statistics, media and transfers." },
      { property: "og:title", content: "Club — MansourAlmailScores" },
      { property: "og:description", content: "Club profile: matches, standings, squad, statistics, media and transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

type Tab = "matches" | "standings" | "squad" | "info" | "stats" | "media" | "transfers" | "news";
const TABS: Tab[] = ["matches", "standings", "squad", "info", "stats", "media", "transfers", "news"];

function TeamPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<Tab>("matches");
  useRealtime(["teams", "players", "matches", "standings_rows", "transfers"]);

  const team = useQuery({ queryKey: ["team", id], queryFn: async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    return data as Team | null;
  }});
  const squad = useQuery({ queryKey: ["squad", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*").eq("team_id", id).order("shirt_number");
    return (data ?? []) as Player[];
  }});
  const matches = useQuery({ queryKey: ["team-matches", id], queryFn: async () => {
    const { data } = await supabase.from("matches")
      .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order("kickoff_at", { ascending: false });
    return (data ?? []) as unknown as MatchWithTeams[];
  }});
  const rows = useQuery({ queryKey: ["team-standings", id], queryFn: async () => {
    const { data: mine } = await supabase.from("standings_rows").select("competition_id").eq("team_id", id);
    const compIds = [...new Set((mine ?? []).map((r) => r.competition_id))];
    if (compIds.length === 0) return [];
    const { data } = await supabase.from("standings_rows")
      .select("*, competition:competition_id(name,slug), team:team_id(id,name,logo_url)")
      .in("competition_id", compIds)
      .order("sort_order");
    return (data ?? []) as unknown as (StandingRow & { competition: { name: string; slug: string } | null; team: { id: string; name: string; logo_url: string | null } | null })[];
  }});
  const coaches = useQuery({ queryKey: ["team-coaches", id], queryFn: async () => {
    const { data } = await supabase.from("coaches").select("*").eq("team_id", id);
    return (data ?? []) as Coach[];
  }});
  const transfers = useQuery({ queryKey: ["team-transfers", id, team.data?.name], enabled: !!team.data, queryFn: async () => {
    const name = team.data!.name;
    const { data } = await supabase.from("transfers").select("*")
       .or(`from_club.eq.${name},to_club.eq.${name}`).in("season", ["25/26", "26/27"]).order("moved_on", { ascending: false, nullsFirst: false });
    return (data ?? []) as Transfer[];
  }});

  if (team.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!team.data) return <AppShell><EmptyState title={tx("Club not found")} /></AppShell>;
  const t = team.data;
  if (t.is_temporary) {
    return (
      <AppShell>
      <BackButton />
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 text-center">
          <TeamCrest name={t.name} logo={t.logo_url} className="mx-auto h-16 w-16" rounded="rounded-2xl" />
          <h1 className="mt-4 text-xl font-bold">{tx(t.name)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{tx("Temporary club — no profile details are published for this club.")}</p>
        </div>
      </AppShell>
    );
  }

  const played = matches.data?.filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status)) ?? [];
  const wins = played.filter((m) => (m.home_team_id === id ? (m.home_score ?? 0) > (m.away_score ?? 0) : (m.away_score ?? 0) > (m.home_score ?? 0))).length;
  const draws = played.filter((m) => (m.home_score ?? 0) === (m.away_score ?? 0)).length;
  const losses = played.length - wins - draws;
  const gf = played.reduce((s, m) => s + (m.home_team_id === id ? m.home_score ?? 0 : m.away_score ?? 0), 0);
  const ga = played.reduce((s, m) => s + (m.home_team_id === id ? m.away_score ?? 0 : m.home_score ?? 0), 0);

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <TeamCrest name={t.name} logo={t.logo_url} className="h-16 w-16 shrink-0" rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{tx(t.name)}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlagIcon value={t.country_code ?? t.country} />
            <span className="truncate">{[tx(t.country), tx(t.venue_name)].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <FavoriteButton kind="team" id={t.id} size="md" />
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-xs">
        {TABS.map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tr(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        matches.data && matches.data.length > 0 ? (
          <div className="space-y-3">
            {[...matches.data.reduce((map, m) => {
              const key = m.competition?.slug ?? "other";
              map.set(key, [...(map.get(key) ?? []), m]);
              return map;
            }, new Map<string, MatchWithTeams[]>()).values()].map((ms) => (
              <div key={ms[0].competition?.slug ?? "other"} className="overflow-hidden rounded-2xl border border-border bg-card">
                {ms[0].competition ? (
                  <Link to="/competitions/$slug" params={{ slug: ms[0].competition.slug }} className="flex items-center gap-2.5 border-b border-border px-4 py-3 hover:bg-accent">
                    {ms[0].competition.logo_url ? <img src={ms[0].competition.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" /> : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{tx(ms[0].competition.name)}</span>
                      {ms[0].competition.country ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FlagIcon value={ms[0].competition.country_code ?? ms[0].competition.country} />
                          <span className="truncate">{tx(ms[0].competition.country)}</span>
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ) : null}
                <div className="divide-y divide-border">
                  {ms.map((m) => <MatchRow key={m.id} m={m} highlightTeamId={id} />)}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title={tx("No matches yet")} />
      )}

      {tab === "standings" && (
        rows.data && rows.data.length > 0 ? (
          <div className="grid gap-6">
            {[...new Map(rows.data.map((r) => [r.competition_id, r])).values()].map((head) => {
              const group = rows.data!.filter((r) => r.competition_id === head.competition_id);
              return (
                <div key={head.competition_id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <Link to="/competitions/$slug" params={{ slug: head.competition?.slug ?? "" }} className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm font-bold hover:text-primary">
                    {tx(head.competition?.name) ?? tx("Competition")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <div className="divide-y divide-border">
                    {group.map((r, index) => (
                      <Link key={r.id} to="/teams/$id" params={{ id: r.team?.id ?? r.team_id }}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent ${r.team_id === id ? "bg-primary/10 font-bold" : ""}`}>
                        <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{num(index + 1)}</span>
                        <TeamCrest name={r.team?.name} logo={r.team?.logo_url} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{tx(r.team?.name) ?? tx("Team")}</span>
                        {r.qualification_label && <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold sm:inline" style={{ backgroundColor: `${r.qualification_color ?? "#888"}22`, color: r.qualification_color ?? undefined }}>{tx(r.qualification_label)}</span>}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{num(r.played)} · {num(r.gf)}:{num(r.ga)}</span>
                        <span className="w-8 shrink-0 text-end font-black tabular-nums">{num(r.points + r.points_adjust)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title={tx("Not in a table yet")} />
      )}

       {tab === "squad" && (
         <div className="space-y-7">
           <section><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Coach")}</h2>{coaches.data && coaches.data.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coaches.data.map((coach) => <div key={coach.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><PlayerAvatar src={coach.photo_url} name={coach.name} size="sm" /><div><div className="font-medium">{tx(coach.name)}</div><div className="text-xs text-muted-foreground">{tx(coach.nationality) ?? "—"}</div></div></div>)}</div> : <EmptyState title={tx("No coach")} />}</section>
           {(["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const).map((position) => {
             const players = (squad.data ?? []).filter((player) => (player.position ?? "Unknown") === position);
             return <section key={position}><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx(position)}</h2>{players.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{players.map((p) => (
              <Link key={p.id} to="/players/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
                <PlayerAvatar src={p.photo_url} name={p.name} size="sm" />
                <div className="min-w-0"><div className="truncate font-medium">{tx(p.name)}</div><div className="truncate text-xs text-muted-foreground">{tx(p.position) ?? "—"}</div></div>
              </Link>
             ))}</div> : <EmptyState title={tx(`No ${position.toLowerCase()}s`)} />}</section>;
           })}
         </div>
      )}

      {tab === "info" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label={tx("Country")} value={tx(t.country) ?? "—"} icon={<FlagIcon value={t.country_code ?? t.country} size="md" />} />
          <InfoCard label={tx("Stadium")} value={[tx(t.venue_name), tx(t.venue_city)].filter(Boolean).join(", ") || "—"} />
           <InfoCard label={tx("Chairman")} value={tx(t.chairman) ?? "—"} />
          <InfoCard label={tx("Short name")} value={t.short_name ?? "—"} />
          <InfoCard label={tx("Founded")} value={t.founded_on ? num(dates.date(t.founded_on, { dateStyle: "long" })) : "—"} />
          <InfoCard label={tx("Trophies")} value={String(t.trophies ?? 0)} />
          {t.description && <div className="rounded-2xl border border-border bg-card p-4 text-sm sm:col-span-2">{tx(t.description)}</div>}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <InfoCard label={tx("Played")} value={String(played.length)} />
          <InfoCard label={tx("Wins")} value={String(wins)} />
          <InfoCard label={tx("Draws")} value={String(draws)} />
          <InfoCard label={tx("Losses")} value={String(losses)} />
          <InfoCard label={tx("Goals for")} value={String(gf)} />
          <InfoCard label={tx("Goals against")} value={String(ga)} />
        </div>
      )}

      {tab === "media" && (
        (t.media_urls?.length ?? 0) > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {t.media_urls.map((u) => <img key={u} src={u} alt="" className="h-40 w-full rounded-2xl border border-border object-cover" />)}
          </div>
        ) : <EmptyState title={tx("No media yet")} />
      )}

      {tab === "transfers" && (
        transfers.data && transfers.data.length > 0 ? (
          <div className="grid gap-2">
            {transfers.data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="flex-1 truncate">{r.from_club ?? "—"}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{r.to_club ?? "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.moved_on ? num(dates.date(r.moved_on)) : ""}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title={tx("No transfers yet")} />
      )}

      {tab === "news" && <LinkedNews kind="team" id={t.id} />}
    </AppShell>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">{icon}{value}</div>
    </div>
  );
}