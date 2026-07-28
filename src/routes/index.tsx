import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Match, type Team, type NewsPost } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";
import { Trophy } from "lucide-react";

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
        .order("published_at", { ascending: false })
        .limit(3);
      return (data ?? []) as NewsPost[];
    },
  });

  return (
    <AppShell>
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card to-card p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{t("home.hero.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("home.hero.desc")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/competitions/$slug" params={{ slug: "world-cup-2026" }} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow">
            <Trophy className="h-4 w-4" /> {t("home.hero.wc")}
          </Link>
          <Link to="/competitions" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background/60 px-4 text-sm font-medium">
            {t("home.hero.competitions")}
          </Link>
        </div>
      </div>

      {(live.data?.length ?? 0) > 0 && <MatchSection title={t("home.live")} data={live.data} loading={live.isLoading} />}
      <MatchSection title={t("home.upcoming")} data={upcoming.data} loading={upcoming.isLoading} />

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
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{[c.country, c.season].filter(Boolean).join(" · ")}</div>
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
              <Link key={n.id} to="/news" className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg">
                {n.cover_url && <img src={n.cover_url} alt="" className="h-32 w-full object-cover" />}
                <div className="p-4">
                  <div className="font-semibold">{n.title}</div>
                  {n.excerpt && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.excerpt}</div>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function CompLogo({ logo }: { logo: string | null }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
      {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6" />}
    </div>
  );
}

export function MatchSection({ title, data, loading }: { title: string; data: MatchWithTeams[] | undefined; loading: boolean }) {
  return (
    <section className="mt-8">
      <SectionHeader title={title} />
      {loading ? (
        <LoadingSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No matches yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => <MatchTile key={m.id} m={m} />)}
        </div>
      )}
    </section>
  );
}

export function MatchTile({ m }: { m: MatchWithTeams }) {
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  return (
    <Link to="/matches/$id" params={{ id: m.id }} className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="truncate">{m.competition?.name}{m.round ? ` · ${m.round}` : ""}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
          {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          {m.status === "live" && m.live_minute ? `${m.live_minute}'` : m.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-3 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <TeamRow name={m.home?.name ?? "TBD"} logo={m.home?.logo_url ?? null} align="right" />
        <div className="text-center">
          {started ? (
            <div className="text-2xl font-black tabular-nums">
              {m.home_score ?? 0}<span className="mx-1 text-muted-foreground">–</span>{m.away_score ?? 0}
              {m.status === "pen" && m.home_pen != null && m.away_pen != null && (
                <div className="text-xs font-medium text-muted-foreground">({m.home_pen}–{m.away_pen} pens)</div>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-muted-foreground">{formatKickoff(m.kickoff_at)}</div>
          )}
        </div>
        <TeamRow name={m.away?.name ?? "TBD"} logo={m.away?.logo_url ?? null} align="left" />
      </div>
    </Link>
  );
}

function TeamRow({ name, logo, align }: { name: string; logo: string | null; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && logo && <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />}
      <span className="truncate text-sm font-semibold">{name}</span>
      {align === "right" && logo && <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />}
    </div>
  );
}