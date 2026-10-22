import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, matchClockSeconds, type Competition, type Match, type Team, type NewsPost } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";
import { useFavorites, FavoriteButton } from "@/hooks/use-favorites";
import { MatchGroups, MatchRow, type MatchWithTeams } from "@/components/match-list";
import { Trophy, ChevronLeft, ChevronRight, Ticket as TicketIcon, ArrowRight } from "lucide-react";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { Button } from "@/components/ui/button";

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

  const news = useQuery({
    queryKey: ["home", "news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("*")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(3);
      return (data ?? []) as NewsPost[];
    },
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
      <div data-no-gesture className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["matches", "competitions"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`h-10 rounded-full text-sm font-black uppercase tracking-wide transition ${mode === m ? "bg-foreground text-background" : "text-foreground"}`}>
            {tx(m === "matches" ? "Matches" : "Competitions")}
          </button>
        ))}
      </div>

      {mode === "matches" ? (<>
        <ScoreBoard liveCount={live.data?.length ?? 0} />
        <TicketsBanner />
      </>) : (<>
      <section>
        <SectionHeader title={tx("Competitions")} />
        {comps.isLoading ? (
          <LoadingSkeleton />
        ) : !comps.data || comps.data.length === 0 ? (
          <EmptyState title={t("home.empty")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comps.data.map((c) => (
              <Link key={c.id} to="/competitions/$slug" params={{ slug: c.slug }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                <CompLogo logo={c.logo_url} />
                <div className="min-w-0">
                   <div className="truncate font-semibold">{lang === "ar" && c.name_ar ? c.name_ar : tx(c.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{[tx(c.country), c.season].filter(Boolean).join(" · ")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <LiveSection live={live.data} />
      <ScoreBoard liveCount={live.data?.length ?? 0} hideLive title={tx("Today")} />
      <FavoriteMatches />
      </>)}


      {news.data && news.data.length > 0 && (
        <section className="mt-10">
          <SectionHeader title={t("home.news")} />
          <div className="grid gap-3 sm:grid-cols-3">
            {news.data.map((n) => (
              <Link key={n.id} to="/news/$slug" params={{ slug: n.slug }} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg">
                 {n.cover_url && <div className="flex h-32 w-full items-center justify-center bg-muted/60"><img src={n.cover_url} alt="" className="h-full w-full object-contain" /></div>}
                <div className="p-4">
                  <div className="font-semibold">{tx(n.title)}</div>
                   {n.excerpt && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tx(n.excerpt)}</div>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
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
  const [status, setStatus] = useState<"live" | "finished" | "upcoming" | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
        .gte("kickoff_at", start.toISOString())
        .lt("kickoff_at", end.toISOString())
        .order("kickoff_at");
      return (data ?? []) as unknown as MatchWithTeams[];
    },
    refetchInterval: 60_000,
  });

  const rows = (dayQ.data ?? []).filter((m) => {
    if (scope === "favourites") {
      const favTeam = favorites.team.includes(m.home_team_id ?? "") || favorites.team.includes(m.away_team_id ?? "");
      if (!favTeam && !favorites.match.includes(m.id) && !favorites.competition.includes(m.competition_id)) return false;
    }
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
      <div data-no-gesture className="flex items-center gap-2">
        {!hideLive && (
          <button
            onClick={() => setStatus(status === "live" ? null : "live")}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${status === "live" ? "border-destructive bg-destructive/15 text-destructive" : "border-destructive/60 bg-destructive/5 text-destructive"}`}
          >
            {t("board.live")}{liveCount > 0 ? ` (${liveCount})` : ""}
            <span className={`h-3.5 w-3.5 rounded-full border-2 border-destructive ${status === "live" ? "bg-destructive" : ""}`} />
          </button>
        )}
        <div className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-full border border-border bg-card">
          <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => setOffset(offset - 1)} aria-label={tx("Previous day")}><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="ghost" onClick={() => setCalendarOpen(true)} className="min-w-0 flex-1 px-2 text-sm font-semibold text-primary">{dayLabel}</Button>
          <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => setOffset(offset + 1)} aria-label={tx("Next day")}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </div>
      {calendarOpen && <MonthCalendar day={day} onPick={(selected) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        setOffset(Math.round((selected.getTime() - today.getTime()) / 86400000));
        setCalendarOpen(false);
      }} onClose={() => setCalendarOpen(false)} />}

      <div className="mt-4">
        {dayQ.isLoading ? (
          <LoadingSkeleton count={3} className="h-16" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-6 text-center text-sm text-muted-foreground">{t("board.none")}</div>
        ) : (
          <MatchGroups data={rows} />
        )}
      </div>
    </section>
  );
}

function FavoriteMatches() {
  const tx = useTx();
  const { favorites, ready } = useFavorites();
  const [view, setView] = useState<"matches" | "clubs" | "competitions" | "players">("matches");
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
  const others = useQuery({
    enabled: ready && view !== "matches",
    queryKey: ["fav-others", favorites.team.join(","), favorites.player.join(","), favorites.competition.join(",")],
    queryFn: async () => {
      const [teams, players, competitions] = await Promise.all([
        favorites.team.length ? supabase.from("teams").select("id,name,logo_url").in("id", favorites.team) : Promise.resolve({ data: [] }),
        favorites.player.length ? supabase.from("players").select("id,name,photo_url").in("id", favorites.player) : Promise.resolve({ data: [] }),
        favorites.competition.length ? supabase.from("competitions").select("id,name,slug,logo_url").in("id", favorites.competition) : Promise.resolve({ data: [] }),
      ]);
      return {
        teams: (teams.data ?? []) as { id: string; name: string; logo_url: string | null }[],
        players: (players.data ?? []) as { id: string; name: string; photo_url: string | null }[],
        competitions: (competitions.data ?? []) as { id: string; name: string; slug: string; logo_url: string | null }[],
      };
    },
  });

  if (!ready) return null;
  const tabs = [
    { key: "matches", label: "Matches" },
    { key: "clubs", label: "Clubs" },
    { key: "competitions", label: "Competitions" },
    { key: "players", label: "Players" },
  ] as const;
  const row = "flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary";
  const empty = (label: string) => <EmptyState title={tx(label)} />;
  return <section className="mt-8">
    <SectionHeader title={tx("Favorites")} />
    <div data-no-gesture className="mb-4 grid grid-cols-4 border-b border-border">
      {tabs.map((tab) => (
        <button key={tab.key} onClick={() => setView(tab.key)}
          className={`-mb-px truncate border-b-2 px-1 pb-2 text-sm font-semibold transition ${view === tab.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          {tx(tab.label)}
        </button>
      ))}
    </div>
    {view === "matches" && (q.data?.length ? <MatchGroups data={q.data} /> : empty("No favorite matches yet"))}
    {view === "clubs" && (others.data?.teams.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {others.data.teams.map((team) => <Link key={team.id} to="/teams/$id" params={{ id: team.id }} className={row}><TeamCrest name={team.name} logo={team.logo_url} className="h-8 w-8" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{tx(team.name)}</span></Link>)}
    </div> : !others.isLoading && empty("No favorite clubs yet"))}
    {view === "competitions" && (others.data?.competitions.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {others.data.competitions.map((c) => <Link key={c.id} to="/competitions/$slug" params={{ slug: c.slug }} className={row}>{c.logo_url ? <img src={c.logo_url} alt="" className="h-8 w-8 object-contain" /> : <Trophy className="h-6 w-6 text-primary" />}<span className="min-w-0 flex-1 truncate text-sm font-semibold">{tx(c.name)}</span></Link>)}
    </div> : !others.isLoading && empty("No favorite competitions yet"))}
    {view === "players" && (others.data?.players.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {others.data.players.map((player) => <Link key={player.id} to="/players/$id" params={{ id: player.id }} className={row}><PlayerAvatar src={player.photo_url} name={player.name} className="h-8 w-8" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{tx(player.name)}</span></Link>)}
    </div> : !others.isLoading && empty("No favorite players yet"))}
  </section>;
}

/** In-app month calendar, so tapping the date never opens the phone's own picker. */
function MonthCalendar({ day, onPick, onClose }: { day: Date; onPick: (d: Date) => void; onClose: () => void }) {
  const tx = useTx();
  const { lang } = useI18n();
  const [month, setMonth] = useState(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return (
    <div className="border-b border-border bg-muted/30 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-full border border-border text-primary"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-sm font-bold">{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</div>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-full border border-border text-primary"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.6rem] font-bold uppercase text-muted-foreground">
        {Array.from({ length: 7 }, (_, i) => <div key={i}>{new Date(2024, 8, 1 + i).toLocaleDateString(locale, { weekday: "short" })}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => cell ? (
          <button key={index} onClick={() => onPick(cell)}
            className={`h-9 rounded-xl text-sm font-semibold transition ${same(cell, day) ? "bg-primary text-primary-foreground" : same(cell, today) ? "border border-primary/50 text-primary" : "hover:bg-accent"}`}>
            {cell.getDate()}
          </button>
        ) : <div key={index} />)}
      </div>
      <div className="mt-2 flex justify-between">
        <button onClick={() => onPick(today)} className="rounded-full px-3 py-1.5 text-xs font-bold text-primary">{tx("Today")}</button>
        <button onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground">{tx("Close")}</button>
      </div>
    </div>
  );
}

function CompLogo({ logo }: { logo: string | null }) {

  return (
     <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary">
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
            <div className="text-xs font-medium text-muted-foreground">{num(dates.kickoff(m.kickoff_at))}</div>
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