import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader, SwipeTabs } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Team, type Match, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FlagIcon } from "@/components/flag";
import { LinkedNews } from "@/components/linked-news";
import { useCompact, useDates, useNum, useTx } from "@/lib/auto-translate";
import { MatchRow, type MatchWithTeams } from "@/components/match-list";
import { CompetitionStats } from "@/components/competition-stats";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";
import { ArrowLeft, CalendarDays, ChevronRight, Play, Trophy, Bell, Medal, Star, Users, Shapes, Globe2, Flag as FlagIco, ListOrdered } from "lucide-react";
import { competitionTheme, DEFAULT_HERO } from "@/lib/competition-theme";
import { useFavorites } from "@/hooks/use-favorites";
import { SeasonMenu } from "@/components/season-menu";
import { StandingsTable } from "@/components/standings-table";
import { useCompetitionLogo } from "@/lib/comp-logo";
import { useLogoAccent } from "@/lib/logo-accent";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];
type Row = StandingRow & { team: Team | null };

function groupsOf(rows: Row[]): [string | null, Row[]][] {
  const map = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.group_label ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()];
}

export const Route = createFileRoute("/competitions/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — MansourAlmailScores` }] }),
  component: CompetitionPage,
});

function CompetitionPage() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<CompTab>("overview");
  const [season, setSeason] = useState<string | null>(null);
  useRealtime(["competitions", "teams", "matches", "standings_rows", "competition_awards", "media_items"]);

  const comp = useQuery({
    queryKey: ["comp", slug],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").eq("slug", slug).maybeSingle();
      return data as Competition | null;
    },
  });

  const teams = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-teams", comp.data?.id, season],
    queryFn: async () => {
      let linkQuery = supabase.from("competition_teams").select("team_id").eq("competition_id", comp.data!.id);
      const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) linkQuery = linkQuery.eq("season", selectedSeason);
      const { data: links } = await linkQuery;
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : { data: [] };
      return (data ?? []) as Team[];
    },
  });

  const matches = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-matches", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query.order("kickoff_at");
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });

  const standings = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-standings", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows")
        .select("*, team:team_id(id,name,logo_url,short_name)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query
        .order("group_label", { ascending: true, nullsFirst: true })
        .order("sort_order");
      return (data ?? []) as unknown as (StandingRow & { team: Team | null })[];
    },
  });

  const posLabels = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-position-labels", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("standings_position_labels").select("*").eq("competition_id", comp.data!.id);
      const selectedSeason = season ?? comp.data!.season;
      if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query;
      return (data ?? []) as PositionLabel[];
    },
  });
  const knockout = useQuery({
    enabled: !!comp.data && !!comp.data.has_knockout,
    queryKey: ["comp-knockout", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("competition_knockout_ties")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)")
        .eq("competition_id", comp.data!.id);
      const selectedSeason = season ?? comp.data!.season;
      if (selectedSeason) query = query.or(`season.eq.${selectedSeason},season.is.null`);
      const { data } = await query.order("sort_order");
      return (data ?? []) as unknown as KnockoutTie[];
    },
  });
  const media = useQuery({ enabled: !!comp.data, queryKey: ["competition-media", comp.data?.id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "competition").eq("owner_id", comp.data!.id).order("sort_order")).data ?? [] });
  const awards = useQuery({ enabled: !!comp.data, queryKey: ["competition-awards", comp.data?.id], queryFn: async () => (await supabase.from("competition_awards").select("*, player:players(id,name,photo_url)").eq("competition_id", comp.data!.id).order("created_at", { ascending: false })).data ?? [] });
  const titleHolder = teams.data?.find((team) => team.id === comp.data?.title_holder_team_id);
  const compTitles = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-titles", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("competition_teams").select("team_id,titles").eq("competition_id", comp.data!.id).order("titles", { ascending: false });
      return (data ?? []) as { team_id: string; titles: number }[];
    },
  });
  const divisions = useQuery({
    enabled: !!comp.data && !!(comp.data.higher_division_id || comp.data.lower_division_id || (comp.data.youth_competition_ids ?? []).length),
    queryKey: ["comp-divisions", comp.data?.higher_division_id, comp.data?.lower_division_id, (comp.data?.youth_competition_ids ?? []).join(",")],
    queryFn: async () => {
      const ids = [comp.data!.higher_division_id, comp.data!.lower_division_id, ...(comp.data!.youth_competition_ids ?? [])].filter((v): v is string => !!v);
      const { data } = await supabase.from("competitions").select("id,name,slug,logo_url").in("id", ids);
      return (data ?? []) as { id: string; name: string; slug: string; logo_url: string | null }[];
    },
  });

  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { t, lang } = useI18n();
  const compLogo = useCompetitionLogo();
  const { isFavorite, toggle: toggleFavorite } = useFavorites();

  if (comp.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!comp.data) return <AppShell><EmptyState title="Competition not found" /></AppShell>;
  const c = comp.data;
  const friendly = c.format === "friendly";
  // The owner can hide sections, and switch a knockout bracket on next to the table.
  const hidden = new Set((c.hidden_tabs ?? []) as string[]);
  const base: CompTab[] = friendly
    ? ["overview", "matches", "media", "news"]
    : ["overview", "matches", "standings", ...(c.has_knockout ? (["knockout"] as CompTab[]) : []), "stats", "teams", "awards", "media", "news"];
  const tabs = base.filter((item) => item === "overview" || item === "matches" || !hidden.has(item));

  const activeTab: CompTab = tabs.includes(tab) ? tab : "overview";
  const theme = competitionTheme({ slug: c.slug, name: c.name });
  const faved = isFavorite("competition", c.id);
  const activeSeason = season ?? c.season ?? c.seasons?.[0] ?? null;

  return (
    <AppShell>
      <div style={theme ? (theme.vars as React.CSSProperties) : undefined}>
        <CompetitionHero
          c={c}
          logo={compLogo(c)}
          hero={theme ? theme.hero : null}
          activeSeason={activeSeason}
          friendly={friendly}
          faved={faved}
          onToggleFav={() => toggleFavorite("competition", c.id)}
          onSeason={setSeason}
          tab={activeTab}
          tabs={tabs}
          onTab={setTab}
        />



       {activeTab === "overview" && <CompetitionOverviewTab c={c} season={season} teams={teams.data ?? []} titleHolder={friendly ? null : (titleHolder ?? null)} titles={friendly ? [] : (compTitles.data ?? [])} divisions={friendly ? [] : (divisions.data ?? [])} matches={matches.data ?? []} media={media.data ?? []} friendly={friendly} />}

      {activeTab === "matches" && <><SectionHeader title={t("tab.matches")} />
      {matches.data && matches.data.length > 0 ? (
        <CompetitionMatches data={matches.data} />
      ) : <EmptyState title={tx("No matches yet")} />}</>}

      {activeTab === "stats" && !friendly && <><SectionHeader title={t("tab.stats")} />
        <CompetitionStats competitionId={c.id} season={season ?? c.season ?? null} /></>}

      {activeTab === "standings" && !friendly && <><SectionHeader title={t("tab.standings")} action={<div />} />
      {standings.data && standings.data.length > 0 ? <StandingsTable rows={standings.data} labels={posLabels.data ?? []} /> : <EmptyState title={tx("No standings yet")} />}</>}

      {activeTab === "knockout" && <><SectionHeader title={tx("Knockout")} />
        <KnockoutBracket ties={knockout.data ?? []} /></>}

      {activeTab === "teams" && !friendly && <><SectionHeader title={tx("Teams")} />
      {teams.data && teams.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.data.map((t) => (
            <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
              <TeamCrest name={t.name} logo={t.logo_url} className="h-8 w-8 shrink-0" />
              <div className="min-w-0"><div className="truncate font-medium">{tx(t.name)}</div><div className="truncate text-xs text-muted-foreground">{tx(t.country)}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title={tx("No teams yet")} />}</>}
      {activeTab === "awards" && !friendly && <AwardsBoard awards={awards.data ?? []} />}
      {activeTab === "media" && <>{media.data && media.data.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{media.data.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{tx(item.title) || tx("Open media")}</div><div className="mt-1 truncate text-xs text-muted-foreground">{item.url}</div></a>)}</div> : <EmptyState title={tx("No competition media yet")} />}</>}
      {activeTab === "news" && <LinkedNews kind="competition" id={c.id} />}
      </div>
    </AppShell>
  );
}

type CompTab = "overview" | "matches" | "standings" | "knockout" | "stats" | "teams" | "awards" | "media" | "news";

type KnockoutTie = {
  id: string; round_label: string; sort_order: number;
  home_placeholder: string | null; away_placeholder: string | null;
  home_score: number | null; away_score: number | null; note: string | null;
  match_id: string | null;
  home: { id: string; name: string; logo_url: string | null } | null;
  away: { id: string; name: string; logo_url: string | null } | null;
};

/** Bracket rounds. Slots that have no club yet show the place they come from,
 *  for example "1st from Group A". */
function KnockoutBracket({ ties }: { ties: KnockoutTie[] }) {
  const tx = useTx();
  const num = useNum();
  if (ties.length === 0) return <EmptyState title={tx("The knockout rounds are not set yet")} />;
  const rounds = new Map<string, KnockoutTie[]>();
  for (const tie of ties) rounds.set(tie.round_label, [...(rounds.get(tie.round_label) ?? []), tie]);
  const side = (team: KnockoutTie["home"], placeholder: string | null) => team
    ? <Link to="/teams/$id" params={{ id: team.id }} className="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:text-primary">
        <TeamCrest name={team.name} logo={team.logo_url} className="h-6 w-6 shrink-0" />
        <span className="truncate">{tx(team.name)}</span>
      </Link>
    : <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-border text-[0.6rem]">?</span>
        <span className="truncate italic">{tx(placeholder || "To be decided")}</span>
      </span>;
  return (
    <div className="space-y-3">
      {[...rounds.entries()].map(([label, list]) => (
        <section key={label} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx(label)}</div>
          <div className="divide-y divide-border">
            {list.map((tie) => (
              <div key={tie.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {side(tie.home, tie.home_placeholder)}
                  <span className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-xs font-black tabular-nums">
                    {tie.home_score != null && tie.away_score != null ? `${num(tie.home_score)} - ${num(tie.away_score)}` : tx("vs")}
                  </span>
                  {side(tie.away, tie.away_placeholder)}
                </div>
                {tie.note && <p className="mt-1.5 text-[0.7rem] text-muted-foreground">{tx(tie.note)}</p>}
                {tie.match_id && <Link to="/matches/$id" params={{ id: tie.match_id }} className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-bold text-primary">{tx("Open match")} <ChevronRight className="h-3 w-3" /></Link>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const COMP_ALERT_KEY = "mas.competition_notification_ids";

/**
 * Coloured competition header. The band takes its colour from the competition
 * logo itself (a yellow badge gives a yellow header), falling back to the brand
 * navy only when no logo colour can be read.
 */
function CompetitionHero({ c, logo, hero, activeSeason, friendly, faved, onToggleFav, onSeason, tab, tabs, onTab }: {
  c: Competition;
  logo: string | null;
  hero: string | null;
  activeSeason: string | null;
  friendly: boolean;
  faved: boolean;
  onToggleFav: () => void;
  onSeason: (season: string | null) => void;
  tab: CompTab;
  tabs: readonly CompTab[];
  onTab: (tab: CompTab) => void;
}) {
  const tx = useTx();
  const num = useNum();
  const { t, lang } = useI18n();
  const accent = useLogoAccent(hero ? null : logo);
  // No custom hero and no logo to sample: use a clean white band instead of navy.
  const noLogo = !hero && !logo;
  const background = hero ?? (noLogo ? "linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%)" : accent?.hero ?? DEFAULT_HERO);
  const onLight = noLogo || (!hero && Boolean(accent?.onLight));


  const followers = useQuery({
    queryKey: ["comp-followers", c.id, c.followers_override],
    queryFn: async () => {
      if (c.followers_override != null) return c.followers_override;
      const { data } = await supabase.rpc("competition_follower_count", { _competition_id: c.id });
      return typeof data === "number" ? data : 0;
    },
  });
  const [bump, setBump] = useState(0);
  const followerCount = Math.max(0, (followers.data ?? 0) + bump);

  const [alerts, setAlerts] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMP_ALERT_KEY);
      setAlerts(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { /* ignore */ }
  }, []);
  const alerted = alerts.includes(c.id);
  const toggleAlert = () => {
    const next = alerted ? alerts.filter((id) => id !== c.id) : [...alerts, c.id];
    setAlerts(next);
    try { window.localStorage.setItem(COMP_ALERT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const router = useRouter();
  const fg = onLight ? "oklch(0.2 0.04 260)" : "oklch(1 0 0)";
  const chip = onLight ? "bg-black/10" : "bg-white/15";

  return (
    <div className="-mx-4 -mt-6 mb-4 px-4 pb-0 pt-1 sm:-mx-6 sm:px-6" style={{ background, color: fg }}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => { if (router.history.canGoBack()) router.history.back(); else router.navigate({ to: "/competitions" }); }}
          aria-label={tx("Back")}
          className={`-ms-2 me-auto inline-flex h-9 w-9 items-center justify-center rounded-full ${chip.replace("bg-", "hover:bg-")}`}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={toggleAlert}
          aria-label={tx("Notifications")}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${chip.replace("bg-", "hover:bg-")} ${alerted ? "opacity-100" : "opacity-70"}`}
        >
          <Bell className="h-5 w-5" fill={alerted ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => { onToggleFav(); setBump((v) => (faved ? v - 1 : v + 1)); }}
          aria-label={tx("Follow")}
          className={`-me-2 inline-flex h-9 w-9 items-center justify-center rounded-full ${chip.replace("bg-", "hover:bg-")} ${faved ? "text-amber-400" : "opacity-70"}`}
        >
          <Star className="h-5 w-5" fill={faved ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-md">
          {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6 text-primary" />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-black leading-tight sm:text-xl">{lang === "ar" && c.name_ar ? c.name_ar : tx(c.name)}</h1>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {(c.seasons?.length ?? 0) > 0
              ? <SeasonMenu seasons={c.seasons} value={activeSeason} onChange={onSeason} onHero />
              : <span className="text-xs font-bold opacity-80">{activeSeason ? num(activeSeason) : ""}</span>}
            {!friendly && <FlagIcon value={c.country_code ?? c.country} />}
          </div>
        </div>
        <div className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center backdrop-blur-sm ${chip}`}>
          <div className="text-sm font-black leading-none tabular-nums">{num(followerCount)}</div>
          <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wide opacity-80">
            {tx(followerCount === 1 ? "Follower" : "Followers")}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <SwipeTabs className="gap-1 text-xs sm:text-sm">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => onTab(item)}
              className={`shrink-0 border-b-2 px-3 py-2 font-bold capitalize sm:px-4 ${tab === item ? "border-current" : "border-transparent opacity-65"}`}
            >{item === "awards" ? tx("Awards") : item === "knockout" ? tx("Knockout") : t(`tab.${item}`)}</button>
          ))}
        </SwipeTabs>
      </div>
    </div>
  );
}



function CompetitionOverviewTab({ c, season, teams, titleHolder, titles, divisions, matches, media, friendly = false }: {
  c: Competition;
  season: string | null;
  teams: Team[];
  titleHolder: Team | null;
  titles: { team_id: string; titles: number }[];
  divisions: { id: string; name: string; slug: string; logo_url: string | null }[];
  matches: MatchWithTeams[];
  media: { id: string; url: string; source: string; title: string | null }[];
  friendly?: boolean;
}) {
  return <CompetitionOverviewInner c={c} season={season} teams={teams} titleHolder={titleHolder} titles={titles} divisions={divisions} matches={matches} media={media} friendly={friendly} />;
}

/** Sofascore-style rounds: one card per round, compact rows inside. */
function CompetitionMatches({ data }: { data: MatchWithTeams[] }) {
  const tx = useTx();
  const num = useNum();
  const groups = new Map<string, MatchWithTeams[]>();
  for (const m of data) {
    const key = m.round_number ? `#${m.round_number}` : (m.round ?? "");
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([key, ms]) => (
        <div key={key || "all"} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-bold">
            {key.startsWith("#") ? `${tx("Round")} ${num(Number(key.slice(1)))}` : (tx(key) || tx("Matches"))}
          </div>
          <div className="divide-y divide-border">
            {ms.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetitionOverviewInner({ c, season, teams, titleHolder, titles, divisions, matches, media, friendly = false }: {
  c: Competition;
  season: string | null;
  teams: Team[];
  titleHolder: Team | null;
  titles: { team_id: string; titles: number }[];
  divisions: { id: string; name: string; slug: string; logo_url: string | null }[];
  matches: MatchWithTeams[];
  media: { id: string; url: string; source: string; title: string | null }[];
  friendly?: boolean;
}) {
  const tx = useTx();
  const num = useNum();
  const logo = useCompetitionLogo()(c);

  // Honours (title holder, most titles, title winners) belong to the live/newest season only.
  const isCurrentSeason = !season || !c.season || season === c.season;
  const showHonours = !friendly && isCurrentSeason;
  const winners = titles.filter((r) => r.titles > 0);
  const best = winners[0];
  const bestTeam = best ? teams.find((team) => team.id === best.team_id) : undefined;
  const higher = divisions.find((d) => d.id === c.higher_division_id);
  const lower = divisions.find((d) => d.id === c.lower_division_id);
  const youth = divisions.filter((d) => (c.youth_competition_ids ?? []).includes(d.id));

  const featured = matches.find((match) => ["live", "ht"].includes(match.status)) ?? matches.find((match) => match.status === "scheduled") ?? matches.at(-1);
  const played = matches.filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status)).length;
  const cells: [string, string][] = friendly ? [
    ["Season", season ?? c.season ?? "—"],
    ["Matches", `${played}/${matches.length}`],
    ["Format", "Friendly"],
  ] : [
    ["Season", season ?? c.season ?? "—"],
    ["Teams", String(teams.length)],
    ["Matches", `${played}/${matches.length}`],
    ["Format", c.format],
    ["Sport", c.sport],
    ["Country", c.country ?? "—"],
  ];
  return (
    <div className="space-y-4">
      {/* Season window, straight under the header like the mockup. */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted/60 p-1">
            {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6 text-primary" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-black leading-tight">{tx(c.name)}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {!friendly && <FlagIcon value={c.country_code ?? c.country} />}
              <span className="truncate">{[tx(c.country), tx(c.category)].filter(Boolean).join(" \u00b7 ")}</span>
            </div>
          </div>
        </div>
        <div className="mt-3"><DurationBar startsOn={c.starts_on} endsOn={c.ends_on} /></div>
      </section>

      {/* Key numbers strip — plain neutral cards. */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className={`grid gap-2 ${friendly ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
          {cells.map(([label, value]) => {
            const Icon = CELL_ICONS[label] ?? Star;
            return (
              <div key={label} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3 w-3" /> {tx(label)}
                </div>
                <div className="mt-1.5 truncate text-sm font-black tabular-nums sm:text-base">{tx(value)}</div>
              </div>
            );
          })}
        </div>

      </section>


      {featured && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[0.6rem] font-bold uppercase tracking-wide text-primary">{tx(featured.status === "scheduled" ? "Featured match" : "Latest match")}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{featured.round_number ? `${tx("Round")} ${num(featured.round_number)}` : tx(featured.round)}</div>
            </div>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <MatchRow m={featured} />
        </section>
      )}

      {showHonours && <div className="grid gap-3 sm:grid-cols-2">
        <TeamCell label={tx("Title holder")} team={titleHolder} />
        <TeamCell label={tx("Most titles")} team={bestTeam ?? null} note={best ? String(best.titles) : null} />
      </div>}

      {media.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Highlights and media")}</div>
          <div className="divide-y divide-border">
            {media.slice(0, 4).map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Play className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold sm:text-sm">{tx(item.title) ?? tx("Competition media")}</span>
                  <span className="block text-[0.65rem] uppercase text-muted-foreground">{tx(item.source)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      )}

      {showHonours && winners.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Title winners")}</div>
          <div className="divide-y divide-border">
            {winners.map((r) => {
              const team = teams.find((tm) => tm.id === r.team_id);
              return (
                <Link key={r.team_id} to="/teams/$id" params={{ id: r.team_id }} className="flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-accent sm:text-sm">
                  <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{tx(team?.name) ?? "Team"}</span>
                  <span className="font-black tabular-nums">{num(r.titles)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(higher || lower || youth.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[higher, lower, ...youth].filter((division): division is { id: string; name: string; slug: string; logo_url: string | null } => Boolean(division)).map((division) => (
            <Link key={division.id} to="/competitions/$slug" params={{ slug: division.slug }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary">
              {division.logo_url
                ? <img src={division.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
                : <Trophy className="h-6 w-6 shrink-0 text-primary" />}
              <div className="min-w-0 flex-1">
                <div className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">{division.id === c.higher_division_id ? tx("Higher division") : division.id === c.lower_division_id ? tx("Lower division") : tx("Youth league")}</div>
                <div className="truncate text-xs font-semibold sm:text-sm">{tx(division.name)}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}


      {c.description && <p className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">{tx(c.description)}</p>}
    </div>
  );
}

function TeamCell({ label, team, note }: { label: string; team: Team | null; note?: string | null }) {
  const tx = useTx();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[0.65rem] font-bold uppercase text-muted-foreground">{tx(label)}</div>
      {team ? (
        <Link to="/teams/$id" params={{ id: team.id }} className="mt-2 flex items-center gap-2 text-sm font-semibold hover:text-primary">
          <TeamCrest name={team.name} logo={team.logo_url} className="h-7 w-7 shrink-0" />
          <span className="min-w-0 truncate">{tx(team.name)}</span>
          {note && <span className="ms-auto font-black tabular-nums">{note}</span>}
        </Link>
      ) : <div className="mt-2 text-sm font-semibold">—</div>}
    </div>
  );
}

/** Tournament duration as a live progress bar between the start and end dates. */
function DurationBar({ startsOn, endsOn, onHero }: { startsOn: string | null; endsOn: string | null; onHero?: boolean }) {
  const tx = useTx();
  const dates = useDates();
  const num = useNum();
  if (!startsOn || !endsOn) return null;
  const start = new Date(startsOn).getTime();
  const end = new Date(endsOn).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const pct = Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
  return (
    <div>
      <div className={`flex items-center justify-between text-[0.65rem] font-semibold tabular-nums ${onHero ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
        <span>{num(dates.dob(startsOn))}</span>
        <span className="uppercase tracking-wide">{tx("Duration")} · {num(pct)}%</span>
        <span>{num(dates.dob(endsOn))}</span>
      </div>
      <div className={`mt-1.5 h-1.5 w-full overflow-hidden rounded-full ${onHero ? "bg-primary-foreground/25" : "bg-muted"}`}>
        <div className={`h-full rounded-full transition-all ${onHero ? "bg-primary-foreground" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const CELL_ICONS: Record<string, typeof Star> = {
  Season: CalendarDays,
  Teams: Users,
  Matches: ListOrdered,
  Format: Shapes,
  Sport: Trophy,
  Country: FlagIco,
};

/** Trophy-style award cards: bigger portrait, gold ribbon and a clear round badge. */
function AwardsBoard({ awards }: { awards: { id: string; award_type: string; round_number: number | null; season: string | null; note: string | null; player: { id: string; name: string; photo_url: string | null } | null }[] }) {
  const tx = useTx();
  const num = useNum();
  if (awards.length === 0) return <EmptyState title={tx("No competition awards yet")} />;
  const season = awards.filter((a) => a.award_type !== "player_of_round");
  const rounds = awards.filter((a) => a.award_type === "player_of_round");
  return (
    <div className="space-y-5">
      {season.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {season.map((award) => (
            <div key={award.id} className="relative overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-400/20 via-card to-card p-5 shadow-sm">
              <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-3 py-1 text-[0.6rem] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
                <Medal className="h-3 w-3" /> {tx("Player of the season")}
              </span>
              <div className="flex items-center gap-4">
                {award.player?.photo_url
                  ? <img src={award.player.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-amber-400/60" />
                  : <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted" />}
                <div className="min-w-0">
                  <div className="truncate text-lg font-black leading-tight">{tx(award.player?.name) ?? tx("Player")}</div>
                  {award.season && <div className="mt-1 text-xs font-bold text-muted-foreground">{num(award.season)}</div>}
                  {award.note && <div className="mt-1 text-xs text-muted-foreground">{tx(award.note)}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {rounds.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Player of the round")}</div>
          <div className="divide-y divide-border">
            {rounds.map((award) => (
              <div key={award.id} className="flex items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.7rem] font-black text-primary">
                  {award.round_number != null ? num(award.round_number) : "—"}
                </span>
                {award.player?.photo_url
                  ? <img src={award.player.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  : <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{tx(award.player?.name) ?? tx("Player")}</div>
                  <div className="truncate text-[0.7rem] text-muted-foreground">
                    {tx("Round")} {award.round_number != null ? num(award.round_number) : "—"}{award.season ? ` · ${num(award.season)}` : ""}
                  </div>
                </div>
                <Medal className="h-4 w-4 shrink-0 text-amber-500" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
