import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
const H2H_NOTICE_KEY = "mascores:h2h-filter-notice-dismissed";
import { useQuery } from "@tanstack/react-query";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, matchClockSeconds, type Competition, type Match, type Team } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";
import { useFavorites, FavoriteButton } from "@/hooks/use-favorites";
import { MatchGroups, MatchRow, type MatchWithTeams } from "@/components/match-list";
import { Trophy, ChevronLeft, ChevronRight, ChevronDown, Globe, Ticket as TicketIcon, ArrowRight, CalendarDays, ListFilter, Plus, Search, X } from "lucide-react";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { Button } from "@/components/ui/button";
import { FlagIcon } from "@/components/flag";
import { groupUpcomingCountries } from "@/lib/upcoming-countries";
import { Calendar } from "@/components/ui/calendar";
import { ar, enGB } from "date-fns/locale";
import { visibleWelcomeTeams } from "@/lib/welcome-teams";
import { DEFAULT_MATCH_VIEW, matchDateKey, matchDates, upcomingStart } from "@/lib/match-calendar";
import { scheduleTime } from "@/lib/fixture-schedule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MaScores — Football, curated" },
      { name: "description", content: "MaScores is a football app built to give you good, reliable information — matches, lineups, live events, standings, transfers, and news for every competition you follow." },
      { property: "og:title", content: "MaScores — Football, curated" },
      { property: "og:description", content: "A football app giving good, reliable information — matches, lineups, standings, and news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});


function Home() {
  const tx = useTx();
  const { t, lang } = useI18n();
  useRealtime(["competitions", "matches", "news_posts"]);
  const [mode, setMode] = useState<"matches" | "competitions">("matches");

  const comps = useQuery({
    queryKey: ["home", "competitions"],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").order("featured", { ascending: false }).order("sort_order").limit(12);
      return (data ?? []) as Competition[];
    },
  });

  const upcoming = useQuery({
    queryKey: ["home", "upcoming"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .gte("kickoff_at", now)
        .order("kickoff_at")
        .limit(9);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });

  const live = useQuery({
    queryKey: ["home", "live"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .in("status", ["live", "ht"])
        .order("kickoff_at")
        .limit(6);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
    refetchInterval: 30_000,
  });

  const recent = useQuery({
    queryKey: ["home", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .in("status", ["ft", "aet", "pen", "awarded"])
        .order("kickoff_at", { ascending: false })
        .limit(6);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });

  return (
    <AppShell>
      <div data-no-gesture role="tablist" aria-label={tx("Football")} className="mb-4 grid grid-cols-2 gap-2 border-b border-border">
        {(["matches", "competitions"] as const).map((m) => (
          <Button variant="ghost" role="tab" aria-selected={mode === m} key={m} onClick={() => setMode(m)}
            className={`-mb-px h-11 w-full gap-1.5 rounded-none border-b-2 px-1 text-xs font-semibold transition ${mode === m ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            {m === "matches" ? <ListFilter className="size-3.5" /> : <Trophy className="size-3.5" />}
            {tx(m === "matches" ? "Matches" : "Competitions")}
          </Button>
        ))}
      </div>

      {mode === "matches" ? (<>
        <ScoreBoard liveCount={live.data?.length ?? 0} />
        <TicketsBanner />
      </>) : (<>
      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-primary" /><h2>{tx("Competitions")}</h2></div>
        {comps.isLoading ? (
          <LoadingSkeleton />
        ) : !comps.data || comps.data.length === 0 ? (
          <EmptyState title={t("home.empty")} />
        ) : (
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {comps.data.map((c) => (
              <Link key={c.id} to="/competitions/$slug" params={{ slug: c.slug }} className="group flex items-center gap-3 border-b border-border/60 py-3 transition hover:bg-accent/40">
                <CompLogo logo={c.logo_url} />
                <div className="min-w-0 flex-1">
                   <div className="text-sm font-semibold leading-5">{lang === "ar" && c.name_ar ? c.name_ar : tx(c.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{[tx(c.country), c.season].filter(Boolean).join(" · ")}</div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </Link>
            ))}
          </div>
        )}
      </section>
      <LiveSection live={live.data} />
      <ScoreBoard liveCount={live.data?.length ?? 0} hideLive title={tx("Today")} />
      <FavoriteMatches />
      </>)}


      <UpcomingCountries />
    </AppShell>
  );
}

/** Sofascore-style control bar: scope tabs, date stepper and status chips. */
/**
 * Prominent home entry point to the ticket shop, so fans do not have to dig
 * through the More menu to buy a match pass.
 */
function TicketsBanner() {
  const tx = useTx();
  const count = useQuery({
    queryKey: ["tickets-on-sale"],
    queryFn: async () => (await supabase.from("ticket_offers").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approval_status", "approved")).count ?? 0,
  });
  if ((count.data ?? 0) === 0) return null;
  return (
    <Link to="/tickets" className="mb-5 flex min-h-20 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/60">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><TicketIcon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-bold uppercase tracking-widest text-primary">{tx("Tickets")}</span>
        <span className="block truncate text-sm font-black">{tx("Buy match tickets")}</span>
        <span className="block truncate text-[0.7rem] text-muted-foreground">{tx("Secure QR entry passes")}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
    </Link>
  );
}

function ScoreBoard({ liveCount, hideLive, title }: { liveCount: number; hideLive?: boolean; title?: string }) {
  const tx = useTx();
  const { t, lang } = useI18n();
  const { favorites } = useFavorites();
  const [scope, setScope] = useState<"all" | "favourites" | "competitions">("all");
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"live" | "finished" | "upcoming" | null>(DEFAULT_MATCH_VIEW);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  type FilterTeam = { id: string; name: string; logo_url: string | null };
  const [teamFilters, setTeamFilters] = useState<FilterTeam[]>([]);
  const [pendingPair, setPendingPair] = useState<FilterTeam[] | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const day = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const dayQ = useQuery({
    queryKey: ["board", day.toISOString()],
    queryFn: async () => {
      const start = new Date(day);
      const end = new Date(day);
      end.setDate(end.getDate() + 1);
      const { data } = await supabase
        .from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .or(`and(kickoff_at.gte.${start.toISOString()},kickoff_at.lt.${end.toISOString()}),and(kickoff_at.is.null,kickoff_date.eq.${matchDateKey(day)})`)
        .order("kickoff_at");
      return ((data ?? []) as unknown as MatchWithTeams[]).sort((a, b) => scheduleTime(a) - scheduleTime(b));
    },
    refetchInterval: 60_000,
  });

  // When the picked day has no matches at all, offer the next scheduled ones.
  const [showUpcoming, setShowUpcoming] = useState(false);
  const upcomingQ = useQuery({
    enabled: status === "upcoming" || (!dayQ.isLoading && (dayQ.data ?? []).length === 0),
    queryKey: ["board", "upcoming", day.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .eq("status", "scheduled")
        .or(`kickoff_at.gte.${upcomingStart(day)},and(kickoff_at.is.null,kickoff_date.gte.${matchDateKey(day)})`)
        .order("kickoff_at");
      return ((data ?? []) as unknown as MatchWithTeams[]).sort((a, b) => scheduleTime(a) - scheduleTime(b));
    },
  });


  const activeQ = status === "upcoming" ? upcomingQ : dayQ;
  const rows = (activeQ.data ?? []).filter((m) => {
    if (scope === "favourites") {
      const favTeam = favorites.team.includes(m.home_team_id ?? "") || favorites.team.includes(m.away_team_id ?? "");
      if (!favTeam && !favorites.match.includes(m.id) && !favorites.competition.includes(m.competition_id)) return false;
    }
    if (teamFilters.some((f) => m.home_team_id !== f.id && m.away_team_id !== f.id)) return false;
    if (status === "live") return ["live", "ht"].includes(m.status);
    if (status === "finished") return ["ft", "aet", "pen", "awarded"].includes(m.status);
    if (status === "upcoming") return m.status === "scheduled";
    return true;
  });

  const dayLabel = offset === 0 ? t("board.today")
    : offset === 1 ? t("board.tomorrow")
    : offset === -1 ? t("board.yesterday")
    : day.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });

  const chip = (key: "live" | "finished" | "upcoming", label: string) => (
    <Button variant="ghost" size="sm"
      key={key}
      onClick={() => setStatus(status === key ? null : key)}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        status === key
          ? key === "live" ? "bg-destructive/15 text-destructive" : "bg-primary text-primary-foreground"
          : key === "live" && liveCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}{key === "live" && liveCount > 0 ? ` (${liveCount})` : ""}
    </Button>
  );

  return (
    <section className={title ? "mb-8 mt-10" : "mb-8"}>
      {title && <SectionHeader title={title} />}
      <div data-no-gesture className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
        <Button variant="ghost" size="sm" aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
          className="h-9 shrink-0 gap-1.5 rounded-md border px-3 text-xs font-semibold shadow-sm">
          <ListFilter className="size-4" />
          {tx("Filter")}
        </Button>
        {teamFilters.map((teamFilter, i) => (
          <span key={teamFilter.id} className="flex items-center gap-1">
            {i === 1 && <span className="text-[10px] font-bold text-muted-foreground">vs</span>}
            <button type="button" onClick={() => setTeamFilters((cur) => cur.filter((f) => f.id !== teamFilter.id))} aria-label={tx("Clear team filter")}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 text-xs font-semibold text-primary">
              <TeamCrest name={teamFilter.name} logo={teamFilter.logo_url} className="h-5 w-5" rounded="rounded-full" />
              <span className="max-w-24 truncate">{tx(teamFilter.name)}</span>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {!hideLive && (
          <Button variant="ghost" size="sm" aria-pressed={status === "live"}
            onClick={() => setStatus(status === "live" ? null : "live")}
            className={`h-9 shrink-0 gap-1.5 rounded-md border px-3 text-xs font-semibold shadow-sm transition ${status === "live" ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card text-foreground hover:border-destructive/50"}`}
          >
            <span className="size-1.5 rounded-full bg-destructive" />
            {t("board.live")}{liveCount > 0 ? ` (${liveCount})` : ""}
          </Button>
        )}
        <Button variant={status === "upcoming" ? "secondary" : "ghost"} size="sm" aria-pressed={status === "upcoming"}
          onClick={() => { if (status !== "upcoming") setStatus("upcoming"); }}
          className="h-9 shrink-0 rounded-md px-2 text-xs font-semibold">
          {tx("Upcoming")}
        </Button>
        <div className="ms-auto flex h-9 min-w-0 items-center gap-0">
          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground" onClick={() => { setOffset(offset - 1); setStatus(null); }} aria-label={tx("Previous day")}><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" onClick={() => setCalendarOpen(true)} className="h-9 min-w-0 gap-1.5 px-2 text-xs font-semibold"><CalendarDays className="size-3.5 text-muted-foreground" />{dayLabel}</Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground" onClick={() => { setOffset(offset + 1); setStatus(null); }} aria-label={tx("Next day")}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      {calendarOpen && <MonthCalendar day={day} onPick={(selected) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        setOffset(Math.round((selected.getTime() - today.getTime()) / 86400000));
        setStatus(null);
        setCalendarOpen(false);
      }} onClose={() => setCalendarOpen(false)} />}
      {filterOpen && <TeamFilterDialog onClose={() => setFilterOpen(false)} onPick={(team) => {
        setOffset(0); setStatus("upcoming");
        setTeamFilters([team]);
      }} onPickPair={(pair) => {
        setOffset(0); setStatus("upcoming");
        let skip = false;
        try { skip = localStorage.getItem(H2H_NOTICE_KEY) === "1"; } catch { /* ignore */ }
        if (skip) setTeamFilters(pair); else setPendingPair(pair);
      }} />}
      {pendingPair && createPortal(
        <div className="fixed inset-0 z-[130] grid place-items-center bg-background/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h3 className="text-base font-bold">{tx("Head-to-head filter")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx("This will show only matches between")} {tx(pendingPair[0].name)} {tx("and")} {tx(pendingPair[1].name)}.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} className="size-4" />
              {tx("Don't show again")}
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPendingPair(null)}>{tx("Cancel")}</Button>
              <Button onClick={() => {
                if (dontShowAgain) { try { localStorage.setItem(H2H_NOTICE_KEY, "1"); } catch { /* ignore */ } }
                setTeamFilters(pendingPair); setPendingPair(null);
              }}>{tx("Continue")}</Button>
            </div>
          </div>
        </div>, document.body)}

      <div className="mt-4">
        {activeQ.isLoading ? (
          <LoadingSkeleton count={3} className="h-16" />
        ) : status !== "upcoming" && rows.length === 0 && (dayQ.data ?? []).length === 0 && (upcomingQ.data?.length ?? 0) > 0 ? (
          <div className="rounded-2xl border border-border bg-card py-6 text-center text-sm text-muted-foreground">
            {t("board.none")}
            <Button variant="outline" size="sm" aria-expanded={showUpcoming} onClick={() => setShowUpcoming((v) => !v)}
              className="mx-auto mt-3 block rounded-full border-primary/60 px-5 font-bold text-primary">
              {showUpcoming ? tx("Hide upcoming") : tx("Show upcoming")}
            </Button>
            {showUpcoming && (
              <div className="mt-5 text-start">
                <div className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{tx("Upcoming matches")}</div>
                <MatchGroups data={upcomingQ.data ?? []} />
              </div>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-6 text-center text-sm text-muted-foreground">{t("board.none")}</div>
        ) : (
          <MatchGroups data={rows} />
        )}
      </div>
    </section>
  );
}

/** Full-screen match-board filter with Club and Head-to-head sections; teams appear as tappable boxes. */
function TeamFilterDialog({ onClose, onPick, onPickPair }: {
  onClose: () => void;
  onPick: (team: { id: string; name: string; logo_url: string | null }) => void;
  onPickPair: (pair: [{ id: string; name: string; logo_url: string | null }, { id: string; name: string; logo_url: string | null }]) => void;
}) {
  const tx = useTx();
  const [mode, setMode] = useState<"club" | "h2h">("club");
  const [q, setQ] = useState("");
  type FilterTeam = { id: string; name: string; logo_url: string | null };
  const [slots, setSlots] = useState<[FilterTeam | null, FilterTeam | null]>([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const teamsQ = useQuery({
    queryKey: ["filter-teams", "catalogue"],
    queryFn: async () => {
      const [catalogue, comps] = await Promise.all([
        supabase.from("teams").select("id,name,name_ar,short_name,logo_url,country,country_code,is_national,parent_team_id,age_group").order("name"),
        supabase.from("competitions").select("id,slug,name,season").in("slug", ["zain-premier-league", "zain-first-division", "kuwait-u19-league", "kuwait-u17-league"]),
      ]);
      if (catalogue.error) throw catalogue.error;
      if (comps.error) throw comps.error;
      const ids = (comps.data ?? []).map((row) => row.id);
      const { data, error } = await supabase.from("competition_teams").select("competition_id,team_id,season").in("competition_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (error) throw error;
      return { catalogue: (catalogue.data ?? []) as Team[], competitions: (comps.data ?? []) as { id: string; slug: string; name: string; season: string | null }[], memberships: data ?? [] };
    },
  });
  const catalogue = teamsQ.data?.catalogue ?? [];
  const byId = new Map(catalogue.map((team) => [team.id, team]));
  const seasonTeams = (slug: string) => {
    const comp = (teamsQ.data?.competitions ?? []).find((row) => row.slug === slug);
    if (!comp) return [] as Team[];
    return (teamsQ.data?.memberships ?? [])
      .filter((row) => row.competition_id === comp.id && (!row.season || !comp.season || row.season === comp.season))
      .map((row) => byId.get(row.team_id))
      .filter((team): team is Team => Boolean(team));
  };
  const nationals = catalogue
    .filter((team) => team.is_national === true && team.country_code?.toUpperCase() === "KW")
    .sort((a, b) => Number(Boolean(a.age_group)) - Number(Boolean(b.age_group)));
  const sections: { label: string; teams: Team[] }[] = [
    { label: "Zain Premier League", teams: seasonTeams("zain-premier-league") },
    { label: "Kuwait national teams", teams: nationals },
    { label: "Zain First Division", teams: seasonTeams("zain-first-division") },
    { label: "Zain U19 League", teams: seasonTeams("kuwait-u19-league") },
    { label: "Kuwait U17 League", teams: seasonTeams("kuwait-u17-league") },
  ].filter((section) => section.teams.length > 0);
  const searching = q.trim().length > 0;
  const visible = searching ? visibleWelcomeTeams(catalogue, [], q, tx) : [];
  const pick = (team: FilterTeam) => {
    if (mode === "club") { onPick(team); onClose(); return; }
    const other = slots[1 - activeSlot];
    if (other && other.id === team.id) return;
    const chosen: FilterTeam = { id: team.id, name: team.name, logo_url: team.logo_url ?? null };
    const next: [FilterTeam | null, FilterTeam | null] = [...slots];
    next[activeSlot] = chosen;
    setSlots(next);
    if (other) { onPickPair([chosen, other]); onClose(); }
    else { setQ(""); setActiveSlot(activeSlot === 0 ? 1 : 0); }
  };
  const renderSlot = (i: 0 | 1) => {
    const team = slots[i];
    if (!team) return (
      <button key={i} type="button" onClick={() => setActiveSlot(i)}
        className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs font-semibold transition ${activeSlot === i ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
        <Plus className="size-4" />
        {tx("Add club")}
      </button>
    );
    return (
      <div key={i} className={`flex h-14 items-center gap-1 rounded-xl border px-2 transition ${activeSlot === i ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => setActiveSlot(i)} aria-label={tx("Edit club")}>
          <TeamCrest name={team.name} logo={team.logo_url} className="h-8 w-8 shrink-0" rounded="rounded-lg" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{tx(team.name)}</span>
        </button>
        <button type="button" className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label={tx("Remove club")}
          onClick={() => { setSlots((cur) => (i === 0 ? [null, cur[1]] : [cur[0], null])); setActiveSlot(i); setQ(""); }}>
          <X className="size-4" />
        </button>
      </div>
    );
  };
  const teamBox = (team: Team) => {
    const chosen = slots[0]?.id === team.id || slots[1]?.id === team.id;
    return (
      <button key={team.id} type="button" onClick={() => pick({ id: team.id, name: team.name, logo_url: team.logo_url ?? null })}
        className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center transition ${chosen ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"}`}>
        <TeamCrest name={team.name} logo={team.logo_url} className="h-9 w-9" rounded="rounded-lg" />
        <span className="w-full truncate text-[11px] font-semibold leading-tight">{tx(team.name)}</span>
      </button>
    );
  };
  return createPortal(
    <div data-no-gesture className="fixed inset-0 z-[120] overflow-y-auto bg-background text-foreground" role="dialog" aria-modal="true" aria-label={tx("Filter by team")}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={onClose} aria-label="Close">
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </Button>
          <h2 className="text-lg font-bold">{tx("Filter by team")}</h2>
        </div>
        <div className="mt-4 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <Button type="button" size="sm" variant={mode === "club" ? "secondary" : "ghost"} className="rounded-lg font-semibold" aria-pressed={mode === "club"} onClick={() => { setMode("club"); setQ(""); }}>{tx("Club")}</Button>
          <Button type="button" size="sm" variant={mode === "h2h" ? "secondary" : "ghost"} className="rounded-lg font-semibold" aria-pressed={mode === "h2h"} onClick={() => { setMode("h2h"); setQ(""); }}>{tx("Head to head")}</Button>
        </div>
        {mode === "h2h" && (
          <div className="mt-3 shrink-0">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              {renderSlot(0)}
              <span className="self-center text-[10px] font-bold uppercase text-muted-foreground">{tx("vs")}</span>
              {renderSlot(1)}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {slots[0] && slots[1] ? tx("Showing matches between these clubs") : tx("Add two clubs to see only their matches")}
            </p>
          </div>
        )}
        <label className="mt-4 flex h-12 shrink-0 items-center gap-3 rounded-full border border-border bg-card px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search teams")} aria-label={tx("Search teams")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-4 flex-1">
          {teamsQ.isLoading ? <LoadingSkeleton count={6} className="h-14" /> : searching && visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{tx("No teams found")}</div>
          ) : searching ? (
            <div className="grid grid-cols-3 gap-2">
              {visible.map((team) => teamBox(team))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sections.flatMap((section) => section.teams.map((team) => teamBox(team)))}
            </div>
          )}
        </div>
      </div>
    </div>, document.body
  );
}

function UpcomingCountries() {
  const tx = useTx();
  const [open, setOpen] = useState<string[]>([]);
  const fixtures = useQuery({
    queryKey: ["home", "upcoming-countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .eq("status", "scheduled")
        .or(`kickoff_at.gte.${new Date().toISOString()},and(kickoff_at.is.null,kickoff_date.gte.${matchDateKey(new Date())})`).order("kickoff_at");
      if (error) throw error;
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });
  const groups = groupUpcomingCountries(fixtures.data ?? []);
  return <section className="mt-6" aria-label={tx("Upcoming matches")}>
    <div className="mb-3 flex items-center gap-2"><Globe className="size-4 text-primary" /><h2 className="text-sm font-semibold">{tx("Upcoming matches")}</h2></div>
    {fixtures.isLoading ? <LoadingSkeleton count={3} className="h-14" /> : fixtures.isError ? <EmptyState title={tx("Could not load matches")} /> : !groups.length ? <EmptyState title={tx("No upcoming matches")} /> :
      <div className="divide-y divide-border border-y border-border">
        {groups.map((group) => {
          const expanded = open.includes(group.name);
          return <div key={group.name}>
            <Button variant="ghost" aria-expanded={expanded} aria-controls={`country-${group.name.replace(/\s/g, "-")}`} onClick={() => setOpen((current) => expanded ? current.filter((name) => name !== group.name) : [...current, group.name])} className="h-auto min-h-14 w-full justify-start gap-3 rounded-none px-2 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60">{group.name === "World" ? <Globe className="size-5 text-primary" /> : <FlagIcon value={group.code} size="md" />}</span>
              <span className="min-w-0 flex-1 whitespace-normal text-start text-sm font-semibold">{tx(group.name)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{group.matches.length}</span>
              <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
            {expanded && <div id={`country-${group.name.replace(/\s/g, "-")}`} className="pb-4 pt-1"><MatchGroups data={group.matches.map((match) => ({ ...match, competition: match.competition ? { ...match.competition, name: /friendly|friendlies|ودية|وديه/i.test(match.competition.name) ? "Friendlies" : match.competition.name } : null }))} /></div>}
          </div>;
        })}
      </div>}
  </section>;
}

function FavoriteMatches() {
  const tx = useTx();
  const { favorites, ready } = useFavorites();
  const ids = favorites.match;
  const teamIds = favorites.team;
  const q = useQuery({
    enabled: ready && (ids.length > 0 || teamIds.length > 0),
    queryKey: ["fav-matches", ids.join(","), teamIds.join(",")],
    queryFn: async () => {
      const sel = "*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)";
      const out: MatchWithTeams[] = [];
      if (ids.length) {
        const { data } = await supabase.from("matches").select(sel).in("id", ids).order("kickoff_at");
        out.push(...((data ?? []) as unknown as MatchWithTeams[]));
      }
      if (teamIds.length) {
        const { data } = await supabase.from("matches").select(sel)
          .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
          .order("kickoff_at").limit(12);
        out.push(...((data ?? []) as unknown as MatchWithTeams[]));
      }
      return [...new Map(out.map((m) => [m.id, m])).values()];
    },
  });

  if (!ready) return null;
  return (
    <section className="mt-10 mb-8">
      <SectionHeader title={tx("Favorites")} action={
        <Link to="/favorites" className="text-[0.65rem] font-bold uppercase tracking-widest text-primary">{tx("See all")}</Link>
      } />
      {q.data?.length ? <MatchGroups data={q.data} /> : <EmptyState title={tx("No favorite matches yet")} />}
    </section>
  );
}

function LiveSection({ live }: { live: MatchWithTeams[] | undefined }) {
  const tx = useTx();
  if (!live || live.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2 border-s-2 border-destructive ps-3"><h2 className="text-sm font-semibold">{tx("Live")}</h2><span className="text-xs tabular-nums text-muted-foreground">{live.length}</span></div>
      <MatchGroups data={live} />
    </section>
  );
}

/** Match dots are loaded for the visible month, including adjacent calendar days. */
function MonthCalendar({ day, onPick, onClose }: { day: Date; onPick: (d: Date) => void; onClose: () => void }) {
  const tx = useTx();
  const { lang } = useI18n();
  const [month, setMonth] = useState(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const fixtures = useQuery({
    queryKey: ["board", "calendar", month.getFullYear(), month.getMonth()],
    queryFn: async () => {
      const start = new Date(month.getFullYear(), month.getMonth(), -6);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 8);
      const { data, error } = await supabase.from("matches").select("kickoff_at,kickoff_date")
        .or(`and(kickoff_at.gte.${start.toISOString()},kickoff_at.lt.${end.toISOString()}),and(kickoff_at.is.null,kickoff_date.gte.${matchDateKey(start)},kickoff_date.lt.${matchDateKey(end)})`);
      if (error) throw error;
      return data ?? [];
    },
  });
  const marked = matchDates(fixtures.data ?? []);
  return (
    <div data-no-gesture className="pointer-events-auto border-b border-border bg-muted/30 px-3 py-3">
      <Calendar mode="single" selected={day} onSelect={(date) => { if (date) onPick(date); }}
        month={month} onMonthChange={setMonth} locale={lang === "ar" ? ar : enGB}
        className="pointer-events-auto mx-auto w-full bg-transparent"
        classNames={{
          root: "w-full",
          month: "flex w-full flex-col gap-3",
          table: "block w-full [&_tbody]:block",
          weekdays: "grid grid-cols-7",
          week: "mt-1 grid h-11 grid-cols-7",
          day: "relative block h-11 w-full aspect-auto [&_button]:h-11 [&_button]:min-w-0 [&_button]:aspect-auto",
        }}
        modifiers={{ hasMatch: (date) => marked.has(matchDateKey(date)) }}
        modifiersClassNames={{ hasMatch: "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary [&:has([data-selected-single=true])]:after:bg-primary-foreground" }}
      />
      <div className="mt-2 flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => onPick(new Date())} className="text-xs font-bold text-primary">{tx("Today")}</Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground">{tx("Close")}</Button>
      </div>
    </div>
  );
}

function CompLogo({ logo }: { logo: string | null }) {

  return (
     <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-primary">
      {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6" />}
    </div>
  );
}

export function MatchSection({ title, data, loading }: { title: string; data: MatchWithTeams[] | undefined; loading: boolean }) {
  const tx = useTx();
  return (
    <section className="mt-8">
      <SectionHeader title={title} />
      {loading ? (
        <LoadingSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState title={tx("No matches yet")} />
      ) : (
        <MatchGroups data={data} />
      )}
    </section>
  );
}

export function MatchTile({ m }: { m: MatchWithTeams }) {
  const tx = useTx();
  const navigate = useNavigate();
  const num = useNum();
  const dates = useDates();
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  return (
    <Link to="/matches/$id" params={{ id: m.id }} className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {m.competition?.logo_url && <img src={m.competition.logo_url} alt="" className="h-4 w-4 shrink-0 object-contain" />}
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => { if (!m.competition) return; e.preventDefault(); e.stopPropagation(); navigate({ to: "/competitions/$slug", params: { slug: m.competition.slug } }); }}
            className="truncate hover:text-primary"
          >{tx(m.competition?.name)}</span>
          {m.round ? <span className="shrink-0">· {tx(m.round)}</span> : null}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
          {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          {m.status === "live" ? `${Math.max(m.live_minute ?? 0, Math.floor(matchClockSeconds(m) / 60))}'` : m.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-3 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <TeamRow name={tx(m.home?.name) ?? "TBD"} logo={m.home?.logo_url ?? null} align="right" />
        <div className="text-center">
          {started ? (
            <div className="text-2xl font-black tabular-nums">
              {m.home_score ?? 0}<span className="mx-1 text-muted-foreground">–</span>{m.away_score ?? 0}
              {m.status === "pen" && m.home_pen != null && m.away_pen != null && (
                <div className="text-xs font-medium text-muted-foreground">({m.home_pen}–{m.away_pen} pens)</div>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-muted-foreground">{num(dates.kickoff(m.kickoff_at, m.kickoff_date))}</div>
          )}
        </div>
        <TeamRow name={tx(m.away?.name) ?? "TBD"} logo={m.away?.logo_url ?? null} align="left" />
      </div>
    </Link>
  );
}

function TeamRow({ name, logo, align }: { name: string; logo: string | null; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && <TeamCrest name={name} logo={logo} className="h-6 w-6 shrink-0" />}
      <span className="truncate text-sm font-semibold">{name}</span>
      {align === "right" && <TeamCrest name={name} logo={logo} className="h-6 w-6 shrink-0" />}
    </div>
  );
}