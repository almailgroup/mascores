import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Match, type Team, type NewsPost } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";
import { useFavorites } from "@/hooks/use-favorites";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { useDates, useNum, useTx } from "@/lib/auto-translate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MansourAlmailScores — Football, curated" },
      { name: "description", content: "The World Cup 2026 hub and every competition you follow — schedules, lineups, live events, standings, and news." },
      { property: "og:title", content: "MansourAlmailScores" },
      { property: "og:description", content: "The World Cup 2026 hub and every competition you follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type MatchWithTeams = Match & { home: Team | null; away: Team | null; competition: { slug: string; name: string; logo_url: string | null } | null };

function Home() {
  const tx = useTx();
  const { t } = useI18n();
  useRealtime(["competitions", "matches", "news_posts"]);

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
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url)")
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
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url)")
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
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url)")
        .in("status", ["ft", "aet", "pen", "awarded"])
        .order("kickoff_at", { ascending: false })
        .limit(6);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });

  return (
    <AppShell>
      <ScoreBoard liveCount={live.data?.length ?? 0} />

      {(live.data?.length ?? 0) > 0 && <MatchSection title={t("home.live")} data={live.data} loading={live.isLoading} />}
      <MatchSection title={t("home.upcoming")} data={upcoming.data} loading={upcoming.isLoading} />
      <FavoriteMatches />
      {(recent.data?.length ?? 0) > 0 && <MatchSection title={t("home.recent")} data={recent.data} loading={recent.isLoading} />}

      <section className="mt-10">
        <SectionHeader title={t("home.competitions")} />
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
                  <div className="truncate font-semibold">{tx(c.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{[tx(c.country), c.season].filter(Boolean).join(" · ")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

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
function ScoreBoard({ liveCount }: { liveCount: number }) {
  const tx = useTx();
  const { t, lang } = useI18n();
  const { favorites } = useFavorites();
  const [scope, setScope] = useState<"all" | "favourites" | "competitions">("all");
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"live" | "finished" | "upcoming" | null>(null);

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
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url)")
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

  const groups = new Map<string, MatchWithTeams[]>();
  for (const m of rows) {
    const key = m.competition?.name ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  const dayLabel = offset === 0 ? t("board.today")
    : offset === 1 ? t("board.tomorrow")
    : offset === -1 ? t("board.yesterday")
    : day.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });

  const chip = (key: "live" | "finished" | "upcoming", label: string) => (
    <button
      key={key}
      onClick={() => setStatus(status === key ? null : key)}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        status === key
          ? key === "live" ? "bg-destructive/15 text-destructive" : "bg-primary text-primary-foreground"
          : key === "live" && liveCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}{key === "live" && liveCount > 0 ? ` (${liveCount})` : ""}
    </button>
  );

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["all", "favourites", "competitions"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`relative whitespace-nowrap px-3 py-2 text-sm font-bold transition ${scope === s ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(`board.${s}`)}
              {scope === s && <span className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-border">
          <button onClick={() => setOffset(offset - 1)} className="px-2 py-1.5 text-primary hover:bg-accent" aria-label={tx("Previous day")}><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setOffset(0)} className="min-w-24 px-2 py-1.5 text-xs font-semibold text-primary">{dayLabel}</button>
          <button onClick={() => setOffset(offset + 1)} className="px-2 py-1.5 text-primary hover:bg-accent" aria-label={tx("Next day")}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {chip("live", t("board.live"))}
        {chip("finished", t("board.finished"))}
        {chip("upcoming", t("board.upcoming"))}
      </div>

      <div className="border-t border-border p-4">
        {dayQ.isLoading ? (
          <LoadingSkeleton count={3} className="h-16" />
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t("board.none")}</div>
        ) : scope === "competitions" ? (
          <div className="space-y-5">
            {[...groups.entries()].map(([name, ms]) => (
              <div key={name}>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {ms[0].competition?.logo_url && <img src={ms[0].competition.logo_url} alt="" className="h-4 w-4 object-contain" />}
                  {name}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ms.map((m) => <MatchTile key={m.id} m={m} />)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rows.map((m) => <MatchTile key={m.id} m={m} />)}</div>
        )}
      </div>
    </section>
  );
}

function FavoriteMatches() {
  const { t } = useI18n();
  const { favorites, ready } = useFavorites();
  const ids = favorites.match;
  const teamIds = favorites.team;
  const q = useQuery({
    enabled: ready && (ids.length > 0 || teamIds.length > 0),
    queryKey: ["fav-matches", ids.join(","), teamIds.join(",")],
    queryFn: async () => {
      const sel = "*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url)";
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
  if (!q.data || q.data.length === 0) return null;
  return <MatchSection title={t("home.favMatches")} data={q.data} loading={false} />;
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => <MatchTile key={m.id} m={m} />)}
        </div>
      )}
    </section>
  );
}

export function MatchTile({ m }: { m: MatchWithTeams }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  return (
    <Link to="/matches/$id" params={{ id: m.id }} className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="truncate">{tx(m.competition?.name)}{m.round ? ` · ${tx(m.round)}` : ""}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
          {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          {m.status === "live" && m.live_minute ? `${m.live_minute}'` : m.status.toUpperCase()}
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