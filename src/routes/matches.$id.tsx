import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell, BackButton, EmptyState, LoadingSkeleton, SwipeTabs } from "@/components/app-shell";
import { supabase, STATUS_LABELS, roundLabel, matchClockSeconds, formatClock, eventLabel, ratingClass, formatRating, type Match, type Team, type MatchEvent, type Lineup, type Player, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { ChevronRight, PlayCircle, Radio } from "lucide-react";
import { useTx, useNum, useDates } from "@/lib/auto-translate";
import { MatchChat } from "@/components/match-chat";
import { MatchVoice } from "@/components/match-voice";
import { MatchPrediction } from "@/components/match-prediction";
import { MatchMomentum } from "@/components/match-momentum";
import { MapPin, Users, Navigation } from "lucide-react";
import { MatchReminders } from "@/components/match-reminders";
import { FlagIcon } from "@/components/flag";
import { EventIcon as EventArt, hasEventArt } from "@/components/event-icon";
import { nationalOverrideMap, applyCallUp } from "@/lib/national";
import { useLogoAccent } from "@/lib/logo-accent";
import { StandingsTable, type PublicStandingRow } from "@/components/standings-table";
import { MatchShare } from "@/components/match-share";
import { displayShortName } from "@/lib/short-name";
import { FavoriteButton, MatchNotificationButton } from "@/hooks/use-favorites";

/** Crest + name used inside the tinted match hero. */
function HeroTeam({ team }: { team: Team | null }) {
  const tx = useTx();
  const body = (
    <>
      {/* No plate behind the crest: the badge sits straight on the hero colour. */}
      <span className="grid h-16 w-16 place-items-center">
        {team?.logo_url
          ? <img src={team.logo_url} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
          : <TeamCrest name={team?.name} logo={null} className="h-14 w-14" />}
      </span>
      <span className="mt-2 line-clamp-2 min-h-9 text-balance text-sm font-bold leading-4.5 sm:text-base">{tx(team?.name) ?? "TBD"}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col items-center text-center text-white";
  if (!team) return <div className={cls}>{body}</div>;
  return <Link to="/teams/$id" params={{ id: team.id }} className={cls}>{body}</Link>;
}

/** Same slot keys the admin pitch board writes, so the public pitch mirrors it. */
function formationRows(formation: string | null | undefined): string[][] {
  const lines = (formation ?? "4-3-3").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const rows: string[][] = [["GK"]];
  let idx = 1;
  for (const [li, count] of lines.entries()) {
    const row: string[] = [];
    for (let i = 0; i < count; i++) row.push(`L${li + 1}-${i + 1}`);
    rows.push(row);
    idx += count;
  }
  void idx;
  return rows.reverse();
}

export const Route = createFileRoute("/matches/$id")({
  head: ({ params }) => ({ meta: [{ title: `Match — MansourAlmailScores` }, { name: "description", content: `Match center ${params.id}` }] }),
  component: MatchPage,
});

/** Crest + name that navigates to the club page. Both sides keep the same
 *  crest box and name box height so one taller badge never pushes the other
 *  club's name onto two lines. */
function TeamHeadline({ team }: { team: Team | null }) {
  const tx = useTx();
  const body = (
    <>
      <span className="flex h-14 items-center justify-center">
        <TeamCrest name={team?.name} logo={team?.logo_url} className="h-14 w-14" rounded="rounded-2xl" />
      </span>
      <span className="mt-2 line-clamp-2 min-h-10 text-balance text-base font-bold leading-5 sm:text-lg">{tx(team?.name) ?? "TBD"}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col items-center text-center";
  if (!team) return <div className={cls}>{body}</div>;
  return <Link to="/teams/$id" params={{ id: team.id }} className={`${cls} transition hover:text-primary`}>{body}</Link>;
}


function MatchPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { lang } = useI18n();
  const [tab, setTab] = useState<"details" | "lineups" | "stats" | "standings" | "previous" | "media">("details");
  const [lineupSide, setLineupSide] = useState<"home" | "away">("home");
  useRealtime(["matches", "match_events", "match_lineups", "player_ratings", "match_stats", "match_chat_messages", "media_items", "standings_rows"]);
  const m = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url,is_national), away:away_team_id(id,name,logo_url,is_national), competition:competition_id(id,name,name_ar,slug,logo_url,sport,country,country_code)")
        .eq("id", id).maybeSingle();
      return data as (Match & { home: Team | null; away: Team | null; competition: { id: string; name: string; slug: string; logo_url: string | null; sport: string; country: string | null; country_code: string | null } | null }) | null;
    },
  });
  const events = useQuery({
    queryKey: ["match-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events")
        .select("*, player:player_id(id,name,name_ar), team:team_id(id,name)")
        .eq("match_id", id).order("minute").order("extra");
      return (data ?? []) as unknown as (MatchEvent & { player: Player | null; team: Team | null })[];
    },
  });
  const lineups = useQuery({
    queryKey: ["match-lineups", id, m.data?.home?.is_national, m.data?.away?.is_national],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups")
        .select("*, player:player_id(id,name,name_ar,short_name,short_name_ar,shirt_number,position,photo_url)")
        .eq("match_id", id);
      const rows = (data ?? []) as unknown as (Lineup & { player: Player | null })[];
      const overrides = await nationalOverrideMap([m.data?.home ?? null, m.data?.away ?? null]);
      if (overrides.size === 0) return rows;
      // national squads may use a different photo and shirt number for the same player
      return rows.map((row) => {
        const call = overrides.get(row.player_id);
        if (!call || !row.player) return row;
        return { ...row, shirt_number: row.shirt_number ?? call.shirt_number, player: applyCallUp(row.player, call) };
      });
    },
  });
  const stats = useQuery({ queryKey: ["match-stats", id], queryFn: async () => (await supabase.from("match_stats").select("*").eq("match_id", id).order("sort_order")).data ?? [] });
  const prediction = useQuery({ queryKey: ["match-prediction", id], queryFn: async () => (await supabase.from("match_predictions").select("*").eq("match_id", id).maybeSingle()).data });
  const broadcasts = useQuery({ queryKey: ["match-broadcasts", id], queryFn: async () => (await supabase.from("match_broadcasts").select("channel:broadcast_channels(id,name,logo_url,country_code)").eq("match_id", id)).data ?? [] });
  const media = useQuery({ queryKey: ["match-media", id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "match").eq("owner_id", id).order("sort_order")).data ?? [] });
  const ratings = useQuery({ queryKey: ["match-ratings", id], queryFn: async () => (await supabase.from("player_ratings").select("player_id,rating").eq("match_id", id)).data ?? [] });
  // Coach names for the shareable line-up card.
  const coachNames = useQuery({
    queryKey: ["share-coaches", m.data?.home_team_id, m.data?.away_team_id, m.data?.home_coach_id, m.data?.away_coach_id],
    enabled: !!m.data,
    queryFn: async () => {
      const pick = async (coachId: string | null | undefined, teamId: string | null | undefined) => {
        if (coachId) return (await supabase.from("coaches").select("name").eq("id", coachId).maybeSingle()).data?.name ?? null;
        if (teamId) return (await supabase.from("coaches").select("name").eq("team_id", teamId).limit(1).maybeSingle()).data?.name ?? null;
        return null;
      };
      return {
        home: await pick(m.data?.home_coach_id, m.data?.home_team_id),
        away: await pick(m.data?.away_coach_id, m.data?.away_team_id),
      };
    },
  });
  // The hero blends both badges: home colour on the left, away colour on the right.
  const homeAccent = useLogoAccent(m.data?.home?.logo_url ?? null);
  const awayAccent = useLogoAccent(m.data?.away?.logo_url ?? null);
  // Both halves are deepened so the header never glares on a phone screen.
  const homeColor = `color-mix(in oklab, ${homeAccent?.color ?? awayAccent?.color ?? "#16224a"} 68%, #05070d 32%)`;
  const awayColor = `color-mix(in oklab, ${awayAccent?.color ?? homeAccent?.color ?? "#070a12"} 68%, #05070d 32%)`;
  // Two solid halves joined by a thin seam in a slightly shifted tone - never a blend of both colours.
  const seamColor = `color-mix(in oklab, ${homeColor} 50%, #000 25%)`;
  const heroBackground = `linear-gradient(100deg, ${homeColor} 0%, ${homeColor} 49.4%, ${seamColor} 49.4%, ${seamColor} 50.6%, ${awayColor} 50.6%, ${awayColor} 100%)`;
  const [, tickClock] = useState(0);
  useEffect(() => {
    if (!m.data?.timer_running) return;
    const interval = window.setInterval(() => tickClock((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [m.data?.timer_running]);

  if (m.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!m.data) return <AppShell><EmptyState title={tx("Match not found")} /></AppShell>;
  const match = m.data;
  const isLive = ["live", "ht"].includes(match.status);
  const hasStarted = !["scheduled", "postponed", "cancelled"].includes(match.status);
  const lineupsVisible = match.lineups_published && (lineups.data?.length ?? 0) > 0;
  const tabs: ("details" | "lineups" | "stats" | "standings" | "previous" | "media")[] = ["details", ...(lineupsVisible ? ["lineups" as const] : []), "stats", "standings", "previous", "media"];
  const clock = matchClockSeconds(match);

  const scorerList = (teamId: string | null | undefined) => (events.data ?? [])
    .filter((event) => ["goal", "penalty_goal", "penalty", "own_goal", "red", "second_yellow"].includes(event.type) && event.team?.id === teamId)
    .map((event) => ({
      name: lang === "ar" && event.player?.name_ar ? event.player.name_ar : tx(event.player?.name) ?? tx(event.description ?? eventLabel(event.type)),
      minute: `${event.minute ?? ""}${event.extra ? `+${event.extra}` : ""}'${event.type === "own_goal" ? " (OG)" : event.type === "penalty" ? " (P)" : ""}`,
      type: event.type,
    }));
  const homeScorers = scorerList(match.home_team_id);
  const awayScorers = scorerList(match.away_team_id);
  const starters = (teamId: string | null | undefined) => (lineups.data ?? [])
    .filter((row) => row.team_id === teamId && row.is_starting)
    .map((row) => ({ number: row.shirt_number ? String(row.shirt_number) : "", name: tx(displayShortName(row.player?.short_name, row.player?.name)) ?? "" }));
  const shareData = {
    competition: [tx(match.competition?.name) ?? "", roundLabel(match.round_number, match.round) ? tx(roundLabel(match.round_number, match.round)) : ""].filter(Boolean).join(" · "),
    kickoff: dates.kickoff(match.kickoff_at),
    status: match.status === "live" ? formatClock(clock) : tx(STATUS_LABELS[match.status] ?? match.status) ?? match.status,
    home: { name: tx(match.home?.name) ?? "TBD", logo_url: match.home?.logo_url ?? null },
    away: { name: tx(match.away?.name) ?? "TBD", logo_url: match.away?.logo_url ?? null },
    homeScore: String(match.home_score ?? 0),
    awayScore: String(match.away_score ?? 0),
    homeScorers, awayScorers,
    homeLineup: starters(match.home_team_id),
    awayLineup: starters(match.away_team_id),
    // Canvas needs plain colours; the CSS colour-mix hero values cannot be parsed there.
    accent: homeAccent?.color ?? awayAccent?.color ?? "#16224a",
    accentAway: awayAccent?.color ?? homeAccent?.color ?? "#0b1020",
  };

  return (
    <AppShell>
      {/* Hero split between both clubs' badge colours. */}
      <div dir="ltr" className="relative -mx-4 -mt-6 mb-4 overflow-hidden px-4 pb-1 pt-4 text-white sm:-mx-6 sm:px-6"
        style={{ background: heroBackground }}>
        <div className="flex items-center justify-between">
          <BackButton className="mb-0 border-white/20 bg-white/10 text-white hover:text-white" />
          <div className="flex items-center gap-2 [&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white">
            <MatchShare data={shareData} mode="result" />
            <MatchNotificationButton matchId={match.id} teamIds={[match.home_team_id, match.away_team_id]} />
            <FavoriteButton kind="match" id={match.id} />
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold">{num(dates.kickoff(match.kickoff_at))}</span>
        </div>

        <div className="mt-3 grid items-start gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}>
          <HeroTeam team={match.home} />
          <div className="pt-3 text-center">
            {["scheduled", "postponed", "cancelled"].includes(match.status)
              ? <div className="text-lg font-bold">{tx(STATUS_LABELS[match.status] ?? match.status)}</div>
              : <>
                <div className="text-4xl font-black tabular-nums">{num(match.home_score ?? 0)} <span className="text-white/60">-</span> {num(match.away_score ?? 0)}</div>
                {match.status === "pen" && match.home_pen != null && match.away_pen != null && (
                  <div className="text-xs text-white/70">({num(match.home_pen)}–{num(match.away_pen)} {tx("pens")})</div>
                )}
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-white/80">
                  {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                  {match.status === "live" ? num(formatClock(clock)) : tx(STATUS_LABELS[match.status] ?? match.status)}
                </div>
              </>}
          </div>
          <HeroTeam team={match.away} />
        </div>

        {(homeScorers.length > 0 || awayScorers.length > 0) && (
          <div className="mt-4 grid items-start gap-3 text-[0.8rem] text-white/85" style={{ gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}>
            <div className="space-y-1 text-end">{homeScorers.map((scorer, index) => <div key={index} className="flex items-center justify-end gap-1"><span className="truncate" dir={lang === "ar" ? "rtl" : "ltr"}>{scorer.name} {num(scorer.minute)}</span><EventIcon type={scorer.type} /></div>)}</div>
            <div className="w-1" />
            <div className="space-y-1">{awayScorers.map((scorer, index) => <div key={index} className="flex items-center gap-1"><EventIcon type={scorer.type} /><span className="truncate" dir={lang === "ar" ? "rtl" : "ltr"}>{scorer.name} {num(scorer.minute)}</span></div>)}</div>
          </div>
        )}

        {match.venue && <div className="mt-3 text-center text-xs text-white/70">{tx(match.venue)}{match.city ? ` · ${tx(match.city)}` : ""}</div>}

        <div className="mt-4">
          <SwipeTabs className="gap-1 text-sm">
            {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 px-4 py-2 font-semibold capitalize ${tab === item ? "border-b-2 border-white text-white" : "text-white/65"}`}>{tx(item === "media" ? "Media" : item === "previous" ? "Matches" : item === "details" ? "Details" : item === "lineups" ? "Lineups" : item === "standings" ? "Standings" : "Stats")}</button>)}
          </SwipeTabs>
        </div>
      </div>

      <div className="px-4 pb-6 sm:px-6">
      {tab === "details" && match.competition && (
        <Link to="/competitions/$slug" params={{ slug: match.competition.slug }}
          className="mb-4 flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary">
          {match.competition.logo_url
            ? <img src={match.competition.logo_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
            : <span className="h-9 w-9 shrink-0 rounded-full bg-muted" />}
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm font-bold sm:text-base">
            <span className="capitalize">{tx(match.competition.sport)},</span>
            {match.competition.country && <><FlagIcon value={match.competition.country_code ?? match.competition.country} /><span>{tx(match.competition.country)},</span></>}
             <span className="truncate">{lang === "ar" && match.competition.name_ar ? match.competition.name_ar : tx(match.competition.name)}</span>
            {roundLabel(match.round_number, match.round) ? <span className="text-muted-foreground">, {tx(roundLabel(match.round_number, match.round))}</span> : null}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
        </Link>
      )}


      {tab === "details" && <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {hasStarted && !match.result_only && <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Timeline")}</div>
          {events.data && events.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {timelineWithBreaks(events.data, match.status, match.home_team_id).slice().reverse().map((entry) => entry.kind === "divider" ? (
                <li key={entry.key} className="flex items-center justify-center gap-2 bg-muted/40 px-4 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
                  {tx(entry.label)}{entry.score ? <span className="tabular-nums">{num(entry.score)}</span> : null}
                </li>
              ) : (
                <li key={entry.event.id} className={`flex items-center gap-3 px-4 py-2.5 ${entry.side === "away" ? "flex-row-reverse text-end" : ""}`}>
                  <span className="w-9 shrink-0 font-mono text-[0.7rem] text-muted-foreground">{entry.event.minute != null ? num(entry.event.minute) : "-"}{entry.event.extra ? `+${num(entry.event.extra)}` : ""}'</span>
                  <EventIcon type={entry.event.type} />
                  <span className="min-w-0 flex-1">
                    {entry.event.player ? (
                      <Link to="/players/$id" params={{ id: entry.event.player.id }} className="block truncate text-sm font-semibold hover:text-primary">{tx(entry.event.player.name)}</Link>
                    ) : <span className="block truncate text-sm font-semibold">{entry.event.description ?? tx(entry.event.type)}</span>}
                    <span className="block truncate text-[0.65rem] text-muted-foreground">{tx(eventLabel(entry.event.type))}{entry.event.team ? ` · ${tx(entry.event.team.name)}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <div className="px-4 py-6 text-center text-sm text-muted-foreground">{tx("No events yet.")}</div>}
        </div>}

        <div className="space-y-4">
          {match.status === "scheduled" && <MatchPrediction matchId={id} homeLogo={match.home?.logo_url} awayLogo={match.away?.logo_url} fallback={prediction.data ?? null} />}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Match information")}</div>
            <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
              {([["Competition", tx(match.competition?.name)], ["Date & time", num(dates.kickoff(match.kickoff_at))], ["Stadium", tx(match.venue)], ["City", tx(match.city)], ["Referee", tx(match.referee)]] as [string, string | null | undefined][]).filter((item): item is [string, string] => !!item[1]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{k === "Stadium" ? <MapPin className="h-3 w-3" /> : k === "Referee" ? <Users className="h-3 w-3" /> : null}{tx(k)}</dt>
                  <dd className="mt-0.5 break-words font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <MatchReminders matchId={id} kickoffAt={match.kickoff_at} />

          <MatchVenueCard venueId={match.venue_id} venueName={match.venue} />

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground"><Radio className="h-3.5 w-3.5" /> {tx("Where to watch")}</div>
              <div className="flex flex-wrap gap-2 p-4">
                {broadcasts.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No channel yet.")}</p>}
                {broadcasts.data?.map((row, index) => {
                  const channel = Array.isArray(row.channel) ? row.channel[0] : row.channel;
                  return channel ? (
                    <div key={channel.id ?? index} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold">
                      {channel.logo_url && <img src={channel.logo_url} alt="" className="h-6 w-6 object-contain" />}{tx(channel.name)}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

          {match.highlight_url && <a href={match.highlight_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-semibold hover:border-primary"><PlayCircle className="h-5 w-5 text-primary" /> {tx("Watch match highlights")}</a>}
          <MatchVoice matchId={id} />
          <MatchChat matchId={id} />
        </div>
      </div>}

      {tab === "lineups" && lineupsVisible && <div className="space-y-4">
      <div dir="ltr" className="relative grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/60 p-1">
        <span
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out"
          style={{ transform: lineupSide === "away" ? "translateX(calc(100% + 0.25rem))" : "translateX(0)" }}
        />
        {([["home", match.home], ["away", match.away]] as const).map(([side, team]) => (
          <button
            key={side}
            onClick={() => setLineupSide(side)}
            className={`relative z-10 flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${lineupSide === side ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
             <span className="truncate" dir={lang === "ar" ? "rtl" : "ltr"}>{tx(team?.name) ?? "TBD"}</span>
          </button>
        ))}
      </div>
      <div>

      {([["home", match.home, match.home_formation], ["away", match.away, match.away_formation]] as const).filter(([side]) => side === lineupSide).map(([side, team, formation]) => {
        const rows = lineups.data?.filter((item) => item.team_id === team?.id) ?? [];
        const starters = rows.filter((r) => r.is_starting);
        const bench = rows.filter((r) => !r.is_starting);
        const activeFormation = formation ?? "4-3-3";
        const showPitch = starters.length > 0;
        const marksFor = (playerId: string) => (events.data ?? [])
          .map((e) => {
            if (e.player_id === playerId || e.player?.id === playerId) return e.type;
            if (e.sub_out_player_id === playerId) return "substitution";
            return "";
          })
          .filter((type) => type && hasEventArt(type));
        const shortOf = (lu: (typeof rows)[number]) => ({
          number: String(lu.shirt_number ?? lu.player?.shirt_number ?? ""),
          name: tx(displayShortName(lu.player?.short_name, lu.player?.name)) ?? "",
        });
        // The shareable card mirrors what is on screen: formation, pitch, coach and bench.
        const lineupShare = {
          ...shareData,
          lineup: {
            teamName: tx(team?.name) ?? "TBD",
            logo: team?.logo_url ?? null,
            formation: activeFormation,
            coach: (side === "home" ? coachNames.data?.home : coachNames.data?.away) ?? null,
            rows: formationRows(activeFormation).map((row) =>
              row.map((slot) => starters.find((s) => s.position_code === slot)).filter(Boolean).map((lu) => shortOf(lu!))),
            bench: bench.map(shortOf),
          },
        };
        return (
          <div key={side} className="rounded-2xl border border-border bg-card p-4">
            {showPitch && <div className="mb-3 flex items-center justify-between gap-2">
              <MatchShare data={lineupShare} mode="lineups" />
              <span className="rounded bg-muted px-2 py-0.5 text-[0.65rem] font-semibold">{num(activeFormation)}</span>
            </div>}
            {showPitch && (
              // Turf and markings live on a clipped layer so player cards (and the
              // goalkeeper's rating on the bottom row) are never cut off.
              <div className="relative mx-auto mb-4 aspect-[3/4] w-full max-w-md rounded-2xl px-3 pb-9 pt-6">
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" style={{ background: "repeating-linear-gradient(180deg,#1b7a3f 0 28px,#17703a 28px 56px)" }} />
                <span className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/35" />
                <span className="pointer-events-none absolute left-2 right-2 top-1/2 border-t-2 border-white/35" />
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
                <span className="pointer-events-none absolute left-1/2 top-2 h-12 w-32 -translate-x-1/2 border-2 border-t-0 border-white/35" />
                <span className="pointer-events-none absolute bottom-2 left-1/2 h-12 w-32 -translate-x-1/2 border-2 border-b-0 border-white/35" />
                <div className="relative flex h-full flex-col justify-between overflow-visible">
                {formationRows(activeFormation).map((row, ri) => (
                <div key={ri} className="relative flex min-h-0 flex-1 items-center justify-around gap-1 py-1">
                    {row.map((slot) => {
                      const lu = starters.find((s) => s.position_code === slot);
                      if (!lu) return <div key={slot} className="w-14" />;
                      const marks = marksFor(lu.player_id);
                      const pitchRating = ratings.data?.find((item) => item.player_id === lu.player_id)?.rating;
                      return (
                        <Link key={slot} to="/players/$id" params={{ id: lu.player_id }} className="relative z-10 flex w-16 flex-col items-center gap-0.5 overflow-visible text-center">
                          <span className="relative block h-11 w-11 overflow-visible">
                            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-muted text-xs font-bold">
                              {lu.player?.photo_url ? <img src={lu.player.photo_url} alt="" className="h-full w-full object-cover" /> : num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}
                            </span>
                            {(lu.shirt_number ?? lu.player?.shirt_number) != null && (
                              <span className="absolute -left-1 -top-1 z-30 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[0.6rem] font-black leading-none text-foreground shadow ring-1 ring-border">{num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}</span>
                            )}
                            {marks.length > 0 && <span className="absolute -right-2 -top-2 z-30 flex items-center gap-px rounded-full bg-background p-0.5 shadow ring-2 ring-background">{marks.slice(0, 3).map((t, k) => <EventArt key={k} type={t} className="h-4 w-4" />)}</span>}
                          </span>
                          <span className="line-clamp-1 max-w-full text-[0.6rem] font-semibold leading-tight text-white drop-shadow">{tx(displayShortName(lu.player?.short_name, lu.player?.name))}</span>
                          <span className={`h-4 rounded px-1.5 text-[0.6rem] font-black leading-4 ${pitchRating != null ? ratingClass(Number(pitchRating)) : "opacity-0"}`}>{pitchRating != null ? num(formatRating(pitchRating)) : "0.0"}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
                </div>
              </div>
            )}
            {(() => {
              const list = showPitch ? bench : rows;
              const startersList = showPitch ? [] : list.filter((r) => r.is_starting);
              const benchList = showPitch ? bench : list.filter((r) => !r.is_starting);
              const row = (lu: (typeof rows)[number]) => {
                const rating = ratings.data?.find((item) => item.player_id === lu.player_id)?.rating;
                const marks = marksFor(lu.player_id);
                return (
                  <Link key={lu.id} to="/players/$id" params={{ id: lu.player_id }} className="flex items-center gap-3 border-t border-border py-2 first:border-0">
                    <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}</span>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">{lu.player?.photo_url && <img src={lu.player.photo_url} alt="" className="h-full w-full object-cover" />}</div>
                    <span className="min-w-0 flex-1 truncate font-semibold">{tx(lu.player?.name)}</span>
                    {marks.length > 0 && <span className="flex shrink-0 items-center gap-1">{marks.slice(0, 4).map((t, k) => <EventArt key={k} type={t} className="h-4 w-4" />)}</span>}
                    {rating != null && <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${ratingClass(Number(rating))}`}>{num(formatRating(rating))}</span>}
                    {lu.is_starting && <span className="shrink-0 text-xs text-muted-foreground">{tx(lu.position_code ?? "XI")}</span>}
                  </Link>
                );
              };
              return (
                <>
                  {startersList.length > 0 && <div>{startersList.map(row)}</div>}
                  <TeamCoach teamId={team?.id} coachId={side === "home" ? match.home_coach_id : match.away_coach_id} />
                  {benchList.length > 0 && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Bench")}</h4>
                      {benchList.map(row)}
                    </div>
                  )}
                </>
              );
            })()}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">{tx("No lineup posted.")}</p>}
          </div>
        );
      })}
      </div>
      <MatchMomentum matchId={id} home={match.home} away={match.away} minutes={match.momentum_minutes ?? 90} events={(events.data ?? []).map((e) => ({ minute: e.minute, type: e.type, team_id: e.team_id }))} />
      </div>}
      {tab === "stats" && <MatchStatsPanel rows={stats.data ?? []} home={match.home} away={match.away} />}
      {tab === "previous" && <PreviousMatches home={match.home} away={match.away} currentId={match.id} />}
      {tab === "standings" && <MatchStandings competitionId={match.competition_id} season={match.season} liveTeamIds={isLive ? [match.home_team_id, match.away_team_id].filter(Boolean) as string[] : []} highlightIds={[match.home_team_id, match.away_team_id].filter(Boolean) as string[]} />}
      {tab === "media" && <div><h3 className="mb-3 font-bold">{tx("Videos & media")}</h3><div className="grid gap-2">{media.data?.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{tx(item.title) || tx("Open media")}</div></a>)}{media.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No media posted.")}</p>}</div></div>}
      </div>
    </AppShell>
  );
}

function PreviousMatches(props: { home: Team | null; away: Team | null; currentId: string }) {
  return <PreviousMatchesInner {...props} />;
}

/**
 * Coach block under each lineup. A coach chosen for this specific match wins;
 * otherwise the club's current coach is shown as a fallback.
 */
function TeamCoach({ teamId, coachId }: { teamId: string | undefined; coachId?: string | null }) {
  const tx = useTx();
  const q = useQuery({
    queryKey: ["lineup-coach", teamId, coachId ?? null],
    enabled: !!teamId || !!coachId,
    queryFn: async () => {
      if (coachId) return (await supabase.from("coaches").select("id,name,photo_url,nationality").eq("id", coachId).maybeSingle()).data;
      return (await supabase.from("coaches").select("id,name,photo_url,nationality").eq("team_id", teamId!).limit(1).maybeSingle()).data;
    },
  });
  if (!q.data) return null;
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Coach")}</h4>
      <Link to="/coaches/$id" params={{ id: q.data.id }} className="flex items-center gap-3 py-2 hover:text-primary">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">{q.data.photo_url && <img src={q.data.photo_url} alt="" className="h-full w-full object-cover" />}</div>
        <span className="min-w-0 flex-1 truncate font-semibold">{tx(q.data.name)}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{tx(q.data.nationality) ?? ""}</span>
      </Link>
    </div>
  );
}

/** Head-to-head: only earlier meetings between these two clubs, any competition. */
type PastRow = Match & {
  home: Pick<Team, "id" | "name" | "logo_url"> | null;
  away: Pick<Team, "id" | "name" | "logo_url"> | null;
  competition: { id: string; name: string; logo_url: string | null; country: string | null; country_code: string | null } | null;
};

/**
 * Matches tab: head-to-head by default, with a switch to either club's own
 * past matches, plus "at home" and "this competition" filters.
 */
function PreviousMatchesInner({ home, away, currentId }: {
  home: Team | null; away: Team | null; currentId: string;
}) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const [mode, setMode] = useState<"home" | "h2h" | "away">("h2h");
  const homeId = home?.id ?? null;
  const awayId = away?.id ?? null;

  const q = useQuery({
    enabled: !!homeId || !!awayId,
    queryKey: ["match-history", homeId, awayId, currentId],
    queryFn: async () => {
      const ids = [homeId, awayId].filter(Boolean) as string[];
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), competition:competition_id(id,name,logo_url,country,country_code)")
        .or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`)
        .neq("id", currentId)
        .in("status", ["ft", "aet", "pen", "awarded", "postponed", "cancelled"])
        .order("kickoff_at", { ascending: false }).limit(80);
      return (data ?? []) as unknown as PastRow[];
    },
  });

  if (!homeId && !awayId) return <p className="text-sm text-muted-foreground">{tx("Teams are needed to show matches.")}</p>;

  const focusId = mode === "away" ? awayId : homeId;
  const all = q.data ?? [];
  const rows = all.filter((m) => {
    if (mode === "h2h") {
      const pair = [m.home_team_id, m.away_team_id];
      if (!(pair.includes(homeId) && pair.includes(awayId))) return false;
    } else if (!focusId || (m.home_team_id !== focusId && m.away_team_id !== focusId)) return false;
    return true;
  });

  // Head-to-head summary of the last 10 meetings.
  const h2h = all.filter((m) => [m.home_team_id, m.away_team_id].includes(homeId) && [m.home_team_id, m.away_team_id].includes(awayId)).slice(0, 10);
  let homeWins = 0, awayWins = 0, draws = 0;
  for (const m of h2h) {
    if (m.home_score == null || m.away_score == null) continue;
    if (m.home_score === m.away_score) draws++;
    else if ((m.home_score > m.away_score) === (m.home_team_id === homeId)) homeWins++;
    else awayWins++;
  }

  // Group the visible list by competition, keeping the newest-first order.
  const groups: { key: string; comp: PastRow["competition"]; list: PastRow[] }[] = [];
  for (const m of rows) {
    const key = m.competition_id;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.list.push(m);
    else groups.push({ key, comp: m.competition, list: [m] });
  }


  return (
    <div className="grid gap-4">
      {h2h.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <h3 className="text-sm font-bold">{tx("Head-to-head")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{tx("Last")} {num(h2h.length)} {tx("matches")}</p>
          <div className="mt-3 grid grid-cols-3 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamCrest name={home?.name} logo={home?.logo_url} className="h-9 w-9 shrink-0" />
              <div className="min-w-0 text-start"><div className="text-xl font-black text-primary">{num(homeWins)}</div><div className="truncate text-xs">{tx(home?.name)}</div></div>
            </div>
            <div><div className="text-xl font-black text-muted-foreground">{num(draws)}</div><div className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{tx("Draws")}</div></div>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <div className="min-w-0 text-end"><div className="text-xl font-black text-primary">{num(awayWins)}</div><div className="truncate text-xs">{tx(away?.name)}</div></div>
              <TeamCrest name={away?.name} logo={away?.logo_url} className="h-9 w-9 shrink-0" />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/60 p-1">
          {([["home", home], ["h2h", null], ["away", away]] as const).map(([key, team]) => (
            <button key={key} onClick={() => setMode(key)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-bold ${mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {team ? <TeamCrest name={team.name} logo={team.logo_url} className="h-5 w-5 shrink-0" /> : null}
              {key === "h2h" ? tx("H2H") : <span className="truncate">{tx(team?.name) ?? "TBD"}</span>}
            </button>
          ))}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            {group.comp?.logo_url ? <img src={group.comp.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" /> : <span className="h-7 w-7 shrink-0 rounded-full bg-muted" />}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{tx(group.comp?.name) ?? tx("Competition")}</div>
              {group.comp?.country && <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"><FlagIcon value={group.comp.country_code ?? group.comp.country} />{tx(group.comp.country)}</div>}
            </div>
          </div>
          <div>
            {group.list.map((m) => {
              const off = ["postponed", "cancelled"].includes(m.status);
              const winner = m.home_score != null && m.away_score != null ? (m.home_score > m.away_score ? "home" : m.away_score > m.home_score ? "away" : null) : null;
              return (
                <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-0 hover:bg-accent/50">
                  <span className="w-16 shrink-0 text-[0.7rem] leading-tight text-muted-foreground">
                    <span className={`block ${off ? "line-through" : ""}`}>{num(dates.kickoff(m.kickoff_at))}</span>
                    <span className="block">{off ? "" : tx(STATUS_LABELS[m.status] ?? m.status)}</span>
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    {([["home", m.home, m.home_score] as const, ["away", m.away, m.away_score] as const]).map(([side, team, score]) => (
                      <span key={side} className="flex min-w-0 items-center gap-2">
                        <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
                        <span className={`min-w-0 flex-1 truncate text-sm ${winner === side ? "font-bold" : "text-muted-foreground"}`}>{tx(team?.name) ?? "TBD"}</span>
                        <span className={`shrink-0 text-sm tabular-nums ${winner === side ? "font-bold" : "text-muted-foreground"}`}>{score != null ? num(score) : ""}</span>
                      </span>
                    ))}
                    {off && <span className="block text-[0.7rem] font-semibold text-destructive">{tx(STATUS_LABELS[m.status] ?? m.status)}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{tx("No matches to show with these filters.")}</p>}
    </div>
  );
}


/** League table for the match's competition, with the two clubs highlighted (live-tinted while playing). */
function MatchStandings({ competitionId, season, liveTeamIds, highlightIds }: { competitionId: string; season: string | null; liveTeamIds: string[]; highlightIds: string[] }) {
  const tx = useTx();
  const q = useQuery({
    queryKey: ["match-standings", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows").select("*, team:team_id(id,name,logo_url,short_name)").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query.order("group_label", { ascending: true, nullsFirst: true }).order("sort_order");
      return (data ?? []) as unknown as PublicStandingRow[];
    },
  });
  const labels = useQuery({
    queryKey: ["match-standings-labels", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_position_labels").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query;
      return data ?? [];
    },
  });
  if (!q.data?.length) return <EmptyState title={tx("No standings yet")} />;
  return <StandingsTable rows={q.data} labels={labels.data ?? []} highlightTeamIds={highlightIds} liveTeamIds={liveTeamIds} />;
}


function EventIcon({ type }: { type: string }) {
  return <EventArt type={type} className="h-5 w-5" />;
}

type TimelineEvent = MatchEvent & { player: Player | null; team: Team | null };
type TimelineEntry =
  | { kind: "divider"; key: string; label: string; score?: string }
  | { kind: "event"; event: TimelineEvent; side: "home" | "away" };

/** Insert half-time and full-time dividers into an ordered event list. */
function timelineWithBreaks(events: TimelineEvent[], status: string, homeTeamId: string | null): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let htAdded = false;
  for (const event of events) {
    if (!htAdded && (event.minute ?? 0) > 45) {
      out.push({ kind: "divider", key: "ht", label: "HT" });
      htAdded = true;
    }
    out.push({ kind: "event", event, side: event.team_id && event.team_id !== homeTeamId ? "away" : "home" });
  }
  if (!["scheduled", "live", "ht"].includes(status)) out.push({ kind: "divider", key: "ft", label: "FT" });
  return out;
}
type StatRow = { id: string; label: string; home_value: string | number | null; away_value: string | number | null };

/** Colour-accented comparison bars for published match statistics. */
function MatchStatsPanel({ rows, home, away }: { rows: StatRow[]; home?: Partial<Team> | null; away?: Partial<Team> | null }) {
  const tx = useTx();
  const num = useNum();
  // Bars take each club's own badge colour instead of a fixed blue/green pair.
  const homeAccent = useLogoAccent(home?.logo_url ?? null);
  const awayAccent = useLogoAccent(away?.logo_url ?? null);
  const homeColor = homeAccent?.color ?? "var(--primary)";
  const awayColor = awayAccent?.color ?? "var(--muted-foreground)";
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{tx("No statistics published yet.")}</div>;
  }
  const val = (v: string | number | null) => {
    const n = Number(String(v ?? "").replace("%", ""));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3" style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${homeColor} 16%, var(--card)) 0%, var(--card) 50%, color-mix(in oklab, ${awayColor} 16%, var(--card)) 100%)` }}>
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest name={home?.name} logo={home?.logo_url ?? null} className="h-6 w-6 shrink-0" />
          <span className="truncate text-xs font-bold">{tx(home?.short_name || home?.name || "")}</span>
        </div>
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Statistics")}</span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-xs font-bold">{tx(away?.short_name || away?.name || "")}</span>
          <TeamCrest name={away?.name} logo={away?.logo_url ?? null} className="h-6 w-6 shrink-0" />
        </div>
      </div>
      <div className="divide-y divide-border">
        {rows.map((item) => {
          const h = val(item.home_value);
          const a = val(item.away_value);
          const total = h + a;
          const hp = total > 0 ? (h / total) * 100 : 50;
          return (
            <div key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <strong style={h >= a ? { color: homeColor } : undefined} className={h >= a ? "" : "text-muted-foreground"}>{num(item.home_value)}</strong>
                <span className="text-xs font-semibold text-muted-foreground">{tx(item.label)}</span>
                <strong style={a >= h ? { color: awayColor } : undefined} className={a >= h ? "" : "text-muted-foreground"}>{num(item.away_value)}</strong>
              </div>
              <div className="mt-2 flex h-2 gap-1 overflow-hidden rounded-full">
                <div className="flex justify-end rounded-full" style={{ width: `${hp}%`, background: `color-mix(in oklab, ${homeColor} 18%, transparent)` }}>
                  <span className="h-full w-full rounded-full" style={{ background: `linear-gradient(270deg, ${homeColor} 0%, color-mix(in oklab, ${homeColor} 60%, transparent) 100%)` }} />
                </div>
                <div className="rounded-full" style={{ width: `${100 - hp}%`, background: `color-mix(in oklab, ${awayColor} 18%, transparent)` }}>
                  <span className="block h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${awayColor} 0%, color-mix(in oklab, ${awayColor} 60%, transparent) 100%)` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Stadium block on the match page, with a maps link when one is set. */
function MatchVenueCard({ venueId, venueName }: { venueId: string | null; venueName: string | null }) {
  const tx = useTx();
  const venue = useQuery({
    enabled: !!(venueId || venueName),
    queryKey: ["match-venue", venueId, venueName],
    queryFn: async () => {
      const base = supabase.from("venues").select("id,name,city,country,capacity,image_url,map_url");
      const { data } = venueId ? await base.eq("id", venueId).maybeSingle() : await base.eq("name", venueName!).maybeSingle();
      return data;
    },
  });
  const v = venue.data;
  if (!v) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Stadium")}</div>
      {v.image_url && <img src={v.image_url} alt="" className="h-40 w-full object-cover" />}
      <Link to="/venues/$id" params={{ id: v.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
        <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{tx(v.name)}</div>
          <div className="truncate text-xs text-muted-foreground">{[tx(v.city), tx(v.country)].filter(Boolean).join(", ")}</div>
        </div>
      </Link>
      {/* Directions always work: a saved map link wins, otherwise we search maps for the stadium. */}
      <a
        href={v.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.name, v.city, v.country].filter(Boolean).join(", "))}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm font-bold text-primary hover:bg-accent"
      >
        <Navigation className="h-4 w-4" /> {tx("Directions to the stadium")}
      </a>
    </div>
  );
}
