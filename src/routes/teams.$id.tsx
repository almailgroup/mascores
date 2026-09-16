import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaGallery } from "@/components/media-gallery";
import { AppShell, BackButton, EmptyState, LoadingSkeleton, SwipeTabs } from "@/components/app-shell";
import { supabase, formatKickoff, type Team, type Player, type Match, type StandingRow, type Coach, type Transfer } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FavoriteButton } from "@/hooks/use-favorites";
import { FlagIcon } from "@/components/flag";
import { TeamCrest } from "@/components/team-crest";
import { useI18n } from "@/lib/i18n";
import { PlayerAvatar } from "@/components/player-avatar";
import { SocialLinksSection } from "@/components/social-links";
import { LinkedNews } from "@/components/linked-news";
import { ArrowRight, Landmark, CalendarClock, Crown, Trophy, Users, Phone, Mail, Globe } from "lucide-react";
import { MatchGroups, MatchRow, type MatchWithTeams } from "@/components/match-list";
import { type NationalPlayer, fetchNationalSquad } from "@/lib/national";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { TeamStats, type TeamComp } from "@/components/team-stats";
import { SeasonMenu } from "@/components/season-menu";
import { StandingsTable } from "@/components/standings-table";
import type { Database } from "@/integrations/supabase/types";

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

type Tab = "info" | "matches" | "standings" | "squad" | "stats" | "media" | "transfers" | "news" | "rabta";
const TABS: Tab[] = ["info", "matches", "standings", "squad", "stats", "media", "transfers", "news", "rabta"];

function TeamPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<Tab>("info");
  useRealtime(["teams", "players", "matches", "standings_rows", "transfers"]);

  const team = useQuery({ queryKey: ["team", id], queryFn: async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    return data as Team | null;
  }});
  const squad = useQuery({ queryKey: ["squad", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*").eq("team_id", id).order("shirt_number");
    return (data ?? []) as Player[];
  }});
  const fifaRank = useQuery({ enabled: !!team.data?.is_national, queryKey: ["fifa-rank", id], queryFn: async () => (await supabase.from("fifa_rankings").select("rank,points,previous_rank").eq("team_id", id).order("rank").maybeSingle()).data });
  const nationalSquad = useQuery({ enabled: !!team.data?.is_national, queryKey: ["national-squad", id], queryFn: () => fetchNationalSquad(id) });
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
      .select("*, competition:competition_id(name,slug,logo_url,season,seasons), team:team_id(id,name,logo_url,short_name)")
      .in("competition_id", compIds)
      .order("sort_order");
    return (data ?? []) as unknown as TeamStandingRow[];
  }});
  const positionLabels = useQuery({
    enabled: !!rows.data?.length,
    queryKey: ["team-standings-labels", ...(rows.data ?? []).map((row) => row.competition_id)],
    queryFn: async () => {
      const ids = [...new Set((rows.data ?? []).map((row) => row.competition_id))];
      if (!ids.length) return [];
      const { data } = await supabase.from("standings_position_labels").select("*").in("competition_id", ids);
      return (data ?? []) as Database["public"]["Tables"]["standings_position_labels"]["Row"][];
    },
  });
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
  const venue = useQuery({ queryKey: ["team-venue", team.data?.venue_name], enabled: !!team.data?.venue_name, queryFn: async () => {
    const { data } = await supabase.from("venues").select("id,name,city,capacity").eq("name", team.data!.venue_name!).maybeSingle();
    return (data ?? null) as { id: string; name: string; city: string | null; capacity: number | null } | null;
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
  const upcoming = [...(matches.data ?? [])].filter((m) => m.status === "scheduled" && m.kickoff_at).sort((a, b) => new Date(a.kickoff_at!).getTime() - new Date(b.kickoff_at!).getTime());
  const featured = upcoming[0] ?? matches.data?.[0] ?? null;
  const tournaments = [...new Map((matches.data ?? []).filter((m) => m.competition).map((m) => [m.competition!.slug, m.competition!])).values()];
  const statComps: TeamComp[] = [...new Map((matches.data ?? [])
    .filter((m) => m.competition_id && m.competition)
    .map((m) => [m.competition_id, { id: m.competition_id, name: m.competition!.name, logo_url: m.competition!.logo_url ?? null, season: (m as { season?: string | null }).season ?? null }] as const))
    .values()];


  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-4 sm:p-5">
        <TeamCrest name={t.name} logo={t.logo_url} className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight sm:text-2xl">{tx(t.name)}</h1>
          {t.is_national ? null : (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:text-xs">
              <FlagIcon value={t.country_code ?? t.country} />
              <span className="truncate">{tx(t.country)}</span>
            </div>
          )}
        </div>
        <FavoriteButton kind="team" id={t.id} size="md" />
      </div>

      <SwipeTabs className="mb-5 gap-1 rounded-full border border-border bg-card p-1 text-xs">
        {TABS.map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tr(`tab.${k}`)}
          </button>
        ))}
      </SwipeTabs>


      {tab === "matches" && (
        matches.data && matches.data.length > 0
          ? <TeamMatches data={matches.data} teamId={id} nextId={upcoming[0]?.id ?? null} />
          : <EmptyState title={tx("No matches yet")} />
      )}

      {tab === "standings" && (
        rows.data && rows.data.length > 0 ? (
          <StandingsTabs rows={rows.data} labels={positionLabels.data ?? []} teamId={id} tx={tx} />
        ) : <EmptyState title={tx("Not in a table yet")} />
      )}

       {tab === "squad" && (
         <div className="space-y-7">
           <section><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Coach")}</h2>{coaches.data && coaches.data.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coaches.data.map((coach) => <Link key={coach.id} to="/coaches/$id" params={{ id: coach.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50"><PlayerAvatar src={coach.photo_url} name={coach.name} size="sm" /><div><div className="font-medium">{tx(coach.name)}</div><div className="text-xs text-muted-foreground">{tx(coach.nationality) ?? "—"}</div></div></Link>)}</div> : <EmptyState title={tx("No coach")} />}</section>
           {(["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const).map((position) => {
             const list: Player[] = t.is_national ? (nationalSquad.data ?? []) : (squad.data ?? []);
             const players = list.filter((player) => (player.position ?? "Unknown") === position);
             if (position === "Unknown" && players.length === 0) return null;
             return <section key={position}><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx(position)}</h2>{players.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{players.map((p) => {
              // In a national squad his club is shown next to the position, and opening him
              // keeps the national photo because he was tapped from here.
              const club = t.is_national ? (p as NationalPlayer) : null;
              return (
              <Link key={p.id} to="/players/$id" params={{ id: p.id }} search={t.is_national ? { nt: id } : {}} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
                <PlayerAvatar src={p.photo_url} name={p.name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{tx(p.name)}</div>
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{[p.shirt_number != null ? `#${p.shirt_number}` : null, tx(p.position)].filter(Boolean).join(" · ") || "—"}</span>
                    {club?.club_name ? (
                      <>
                        <span aria-hidden>·</span>
                        {club.club_logo ? <img src={club.club_logo} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" /> : null}
                        <span className="truncate font-semibold text-foreground/80">{tx(club.club_name)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
              );
             })}</div> : <EmptyState title={tx(`No ${position.toLowerCase()}s`)} />}</section>;
           })}
         </div>
      )}

      {tab === "info" && (
        <div className="space-y-4">
          {featured ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx(featured.status === "scheduled" ? "Next match" : "Featured match")}</div>
              <MatchRow m={featured} highlightTeamId={id} />
            </section>
          ) : null}

          <RecentForm matches={matches.data ?? []} teamId={id} />

          <SocialLinksSection value={t.social_links} />

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Tournaments")}</div>
            {tournaments.length > 0 ? (
              <div className="divide-y divide-border">
                {tournaments.map((c) => (
                  <Link key={c.slug} to="/competitions/$slug" params={{ slug: c.slug }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-accent">
                    {c.logo_url ? <img src={c.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" /> : null}
                    <span className="min-w-0 flex-1 truncate">{tx(c.name)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : <p className="p-4 text-sm text-muted-foreground">{tx("No tournaments yet")}</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="divide-y divide-border">
              {coaches.data?.[0] ? (
                <Link to="/coaches/$id" params={{ id: coaches.data[0].id }} className="block hover:bg-accent">
                  <DetailRow icon={<PlayerAvatar src={coaches.data[0].photo_url} name={coaches.data[0].name} size="sm" />} label={tx("Coach")} value={tx(coaches.data[0].name)} />
                </Link>
              ) : null}
              {t.is_national && fifaRank.data ? <DetailRow icon={<Trophy className="h-5 w-5 text-muted-foreground" />} label={tx("FIFA world ranking")} value={`#${num(String(fifaRank.data.rank))} · ${num(String(fifaRank.data.points))} ${tx("pts")}`} /> : null}
              {t.chairman ? <DetailRow icon={<Crown className="h-5 w-5 text-muted-foreground" />} label={tx("Chairman")} value={tx(t.chairman)} /> : null}
              {t.contact_phone ? <a href={`tel:${t.contact_phone}`} className="block hover:bg-accent"><DetailRow icon={<Phone className="h-5 w-5 text-muted-foreground" />} label={tx("Phone")} value={t.contact_phone} chevron /></a> : null}
              {t.contact_email ? <a href={`mailto:${t.contact_email}`} className="block hover:bg-accent"><DetailRow icon={<Mail className="h-5 w-5 text-muted-foreground" />} label={tx("Email")} value={t.contact_email} chevron /></a> : null}
              {t.contact_website ? <a href={/^https?:\/\//i.test(t.contact_website.trim()) ? t.contact_website.trim() : `https://${t.contact_website.trim()}`} target="_blank" rel="noreferrer" className="block hover:bg-accent"><DetailRow icon={<Globe className="h-5 w-5 text-muted-foreground" />} label={tx("Website")} value={t.contact_website.replace(/^https?:\/\//, "")} chevron /></a> : null}
              {t.country && !t.is_national ? <DetailRow icon={<FlagIcon value={t.country_code ?? t.country} size="md" />} label={tx("Country")} value={tx(t.country)} /> : null}
              {t.short_name ? <DetailRow icon={<Users className="h-5 w-5 text-muted-foreground" />} label={tx("Short name")} value={t.short_name} /> : null}
              {t.trophies ? <DetailRow icon={<Trophy className="h-5 w-5 text-muted-foreground" />} label={tx("Trophies")} value={num(String(t.trophies))} /> : null}
              {t.founded_on ? <DetailRow icon={<CalendarClock className="h-5 w-5 text-muted-foreground" />} label={tx("Founded")} value={num(dates.date(t.founded_on, { dateStyle: "long" }))} /> : null}
              {t.venue_name ? (
                venue.data ? (
                  <Link to="/venues/$id" params={{ id: venue.data.id }} className="block hover:bg-accent">
                    <DetailRow icon={<Landmark className="h-5 w-5 text-muted-foreground" />} label={tx("Venue")} value={tx(t.venue_name)} chevron />
                  </Link>
                ) : <DetailRow icon={<Landmark className="h-5 w-5 text-muted-foreground" />} label={tx("Venue")} value={tx(t.venue_name)} />
              ) : null}
              {(venue.data?.capacity || t.venue_city || venue.data?.city) ? (
                <div className="flex divide-x divide-border">
                  {venue.data?.capacity ? (
                    <div className="flex-1 px-4 py-3 text-center">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{tx("Capacity")}</div>
                      <div className="mt-0.5 text-sm font-bold">{num(venue.data.capacity.toLocaleString())}</div>
                    </div>
                  ) : null}
                  {(t.venue_city ?? venue.data?.city) ? (
                    <div className="flex-1 px-4 py-3 text-center">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{tx("City")}</div>
                      <div className="mt-0.5 text-sm font-bold">{tx(t.venue_city ?? venue.data?.city)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
          <YouthTeams team={t} />
          <TeamStaff teamId={t.id} />

          <TeamUltras teamId={t.id} />
          <TeamNewsTeaser teamId={t.id} onMore={() => setTab("news")} />
          {t.description ? <div className="rounded-2xl border border-border bg-card p-4 text-sm">{tx(t.description)}</div> : null}
        </div>
      )}

      {tab === "rabta" && <TeamUltras teamId={t.id} full />}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <InfoCard label={tx("Played")} value={String(played.length)} />
            <InfoCard label={tx("Wins")} value={String(wins)} />
            <InfoCard label={tx("Draws")} value={String(draws)} />
            <InfoCard label={tx("Losses")} value={String(losses)} />
            <InfoCard label={tx("Goals for")} value={String(gf)} />
            <InfoCard label={tx("Goals against")} value={String(ga)} />
          </div>
          <TeamStats teamId={id} comps={statComps} />
        </div>
      )}

      {tab === "media" && (
        (t.media_urls?.length ?? 0) > 0 ? (
          <MediaGallery urls={t.media_urls} />
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
  return InfoCardInner({ label, value, icon });
}

function DetailRow({ icon, label, value, chevron }: { icon: React.ReactNode; label: string; value?: string | null; chevron?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-bold">{value ?? "—"}</span>
      </span>
      {chevron ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}

function InfoCardInner({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">{icon}{value}</div>
    </div>
  );
}

/** SofaScore-style form chart: opponent crests over win/draw/loss bars. */
function RecentForm({ matches, teamId }: { matches: MatchWithTeams[]; teamId: string }) {
  const tx = useTx();
  const played = matches
    .filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status))
    .slice(0, 10)
    .reverse();
  if (played.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-center text-sm font-bold">{tx("Recent form")}</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-muted/50 p-3">
        <div className="flex min-w-max items-stretch gap-2">
          {played.map((m) => {
            const home = m.home_team_id === teamId;
            const own = (home ? m.home_score : m.away_score) ?? 0;
            const other = (home ? m.away_score : m.home_score) ?? 0;
            const opp = home ? m.away : m.home;
            const result = own > other ? "w" : own === other ? "d" : "l";
            return (
              <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="flex w-12 flex-col items-center gap-2">
                <TeamCrest name={opp?.name} logo={opp?.logo_url} className="h-8 w-8" />
                <span className="flex h-28 w-full flex-col justify-center">
                  <span className="flex h-1/2 items-end justify-center">
                    {result === "w" && <span className="h-full w-8 rounded-t-sm bg-success" />}
                  </span>
                  <span className="flex h-1/2 items-start justify-center">
                    {result === "l" && <span className="h-full w-8 rounded-b-sm bg-destructive" />}
                    {result === "d" && <span className="h-1.5 w-8 rounded-sm bg-muted-foreground/50" />}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}


type TeamStandingRow = StandingRow & {
  competition: { name: string; slug: string; logo_url: string | null; season: string | null; seasons: string[] } | null;
  team: { id: string; name: string; logo_url: string | null; short_name: string | null } | null;
};

/** Standings for every competition the club is in, picked from a bar instead of stacked. */
function StandingsTabs({ rows, labels, teamId, tx }: {
  rows: TeamStandingRow[];
  labels: Database["public"]["Tables"]["standings_position_labels"]["Row"][];
  teamId: string;
  tx: (v: string | null | undefined) => string | null | undefined;
}) {
  const comps = [...new Map(rows.map((r) => [r.competition_id, r])).values()];
  const [active, setActive] = useState(comps[0]?.competition_id ?? "");
  const [selectedSeasons, setSelectedSeasons] = useState<Record<string, string>>({});
  const current = comps.find((c) => c.competition_id === active) ?? comps[0];
  const availableSeasons = [...new Set(rows.filter((row) => row.competition_id === current?.competition_id).map((row) => row.season).filter((value): value is string => !!value))];
  const configuredSeason = current?.competition?.season;
  const activeSeason = current ? (selectedSeasons[current.competition_id] ?? (configuredSeason && availableSeasons.includes(configuredSeason) ? configuredSeason : availableSeasons[0]) ?? "") : "";
  const list = rows.filter((r) => r.competition_id === current?.competition_id && (!activeSeason || r.season === activeSeason));
  const currentLabels = labels.filter((label) => label.competition_id === current?.competition_id && (!activeSeason || label.season === activeSeason));

  return (
    <div>
      {comps.length > 1 && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
          {comps.map((c) => (
            <button key={c.competition_id} onClick={() => setActive(c.competition_id)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${c.competition_id === current?.competition_id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {c.competition?.logo_url && <img src={c.competition.logo_url} alt="" className="h-4 w-4 object-contain" />}
              <span className="max-w-[9rem] truncate">{tx(c.competition?.name) ?? tx("Competition")}</span>
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Link to="/competitions/$slug" params={{ slug: current?.competition?.slug ?? "" }}
          className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold hover:text-primary">
          {current?.competition?.logo_url && <img src={current.competition.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" />}
          <span className="min-w-0 flex-1 truncate">{tx(current?.competition?.name) ?? tx("Competition")}</span>
          {availableSeasons.length > 0 && <span onClick={(event) => event.preventDefault()}><SeasonMenu seasons={availableSeasons} value={activeSeason} onChange={(value) => current && setSelectedSeasons((previous) => ({ ...previous, [current.competition_id]: value }))} /></span>}
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
        <div className="p-3"><StandingsTable rows={list} labels={currentLabels} highlightTeamId={teamId} /></div>
      </div>
    </div>
  );
}

/** Youth sides linked to this first team, or the first team when viewing a youth side. */
function YouthTeams({ team }: { team: Team }) {
  const tx = useTx();
  const q = useQuery({
    queryKey: ["youth-teams", team.id, team.parent_team_id],
    queryFn: async () => {
      const children = (await supabase.from("teams").select("id,name,logo_url").eq("parent_team_id", team.id).order("name")).data ?? [];
      const parent = team.parent_team_id
        ? (await supabase.from("teams").select("id,name,logo_url").eq("id", team.parent_team_id).maybeSingle()).data
        : null;
      return { children: children as { id: string; name: string; logo_url: string | null }[], parent };
    },
  });
  const children = q.data?.children ?? [];
  const parent = q.data?.parent ?? null;
  if (children.length === 0 && !parent) return null;
  const rows = [
    ...(parent ? [{ ...parent, tag: "First team" }] : []),
    ...children.map((child) => ({ ...child, tag: "Youth team" })),
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
        {tx(parent ? "Club structure" : "Youth teams")}
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <Link key={row.id} to="/teams/$id" params={{ id: row.id }} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent">
            <TeamCrest name={row.name} logo={row.logo_url} className="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{tx(row.name)}</span>
              <span className="mt-0.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">{tx(row.tag)}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The people around the team beyond the coach. */

function TeamStaff({ teamId }: { teamId: string }) {
  const tx = useTx();
  const staff = useQuery({
    queryKey: ["team-staff-public", teamId],
    queryFn: async () => (await supabase.from("team_staff").select("id,name,role,photo_url").eq("team_id", teamId).order("sort_order")).data ?? [],
  });
  if (!staff.data?.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Staff")}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {staff.data.map((person) => (
          <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <PlayerAvatar src={person.photo_url} name={person.name} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium">{tx(person.name)}</div>
              <div className="truncate text-xs text-muted-foreground">{tx(person.role)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Rabta: where the club's ultras will gather. */
function TeamUltras({ teamId, full = false }: { teamId: string; full?: boolean }) {
  const tx = useTx();
  const posts = useQuery({
    queryKey: ["team-ultras", teamId, full],
    queryFn: async () =>
      (await supabase.from("ultras_posts").select("id,title,body,photo_url,meeting_place,created_at")
        .eq("team_id", teamId).eq("status", "approved").order("created_at", { ascending: false }).limit(full ? 50 : 5)).data ?? [],
  });
  if (!posts.data?.length) {
    return full ? <EmptyState title={tx("No Rabta posts yet")} /> : null;
  }
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Rabta")}</h2>
      <div className="space-y-2">
        {posts.data.map((post) => (
          <div key={post.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            {post.photo_url && <img src={post.photo_url} alt="" className="max-h-64 w-full object-cover" />}
            <div className="p-4">
              <div className="text-sm font-bold">{tx(post.title)}</div>
              {post.meeting_place && <div className="mt-0.5 text-xs font-semibold text-primary">{tx(post.meeting_place)}</div>}
              {post.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{tx(post.body)}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** One headline on Info, with a link into the club's News tab. */
function TeamNewsTeaser({ teamId, onMore }: { teamId: string; onMore: () => void }) {
  const tx = useTx();
  const news = useQuery({
    queryKey: ["team-news-teaser", teamId],
    queryFn: async () =>
      (await supabase.from("news_posts").select("slug,title,excerpt,cover_url,published_at")
        .eq("team_id", teamId).not("published_at", "is", null).order("published_at", { ascending: false }).limit(1)).data ?? [],
  });
  const post = news.data?.[0];
  if (!post) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Latest news")}</h2>
      <Link to="/news/$slug" params={{ slug: post.slug }} className="block overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/50">
        {post.cover_url && <img src={post.cover_url} alt="" className="max-h-56 w-full object-cover" />}
        <div className="p-4">
          <div className="text-sm font-bold">{tx(post.title)}</div>
          {post.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tx(post.excerpt)}</p>}
        </div>
      </Link>
      <button onClick={onMore} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
        {tx("More news")} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
