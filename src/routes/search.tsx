import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, EmptyState, SectionHeader } from "@/components/app-shell";
import { useFootball, CLUB_SEASON, LEAGUES } from "@/lib/football";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [
    { title: "Search — MansourAlmailScores" },
    { name: "description", content: "Search players, teams, competitions, coaches, stadiums and countries." },
    { property: "og:title", content: "Global search — MansourAlmailScores" },
    { property: "og:description", content: "Find any player, team, competition, coach, stadium or country." },
  ] }),
  component: SearchPage,
});

type Filter = "all" | "players" | "teams" | "competitions" | "coaches" | "stadiums" | "countries";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "competitions", label: "Competitions" },
  { id: "coaches", label: "Coaches" },
  { id: "stadiums", label: "Stadiums" },
  { id: "countries", label: "Countries" },
];

function SearchPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const enabled = q.trim().length >= 3;

  const players = useFootball<Array<{ player: { id: number; name: string; photo?: string; nationality?: string } }>>(
    "players", { search: q, league: LEAGUES.PREMIER_LEAGUE, season: CLUB_SEASON },
    { enabled: enabled && (filter === "all" || filter === "players"), select: (d) => d.response as never },
  );
  const teams = useFootball<Array<{ team: { id: number; name: string; logo?: string; country?: string } }>>(
    "teams", { search: q },
    { enabled: enabled && (filter === "all" || filter === "teams"), select: (d) => d.response as never },
  );
  const leagues = useFootball<Array<{ league: { id: number; name: string; logo?: string }; country: { name: string; flag?: string } }>>(
    "leagues", { search: q },
    { enabled: enabled && (filter === "all" || filter === "competitions"), select: (d) => d.response as never },
  );
  const coaches = useFootball<Array<{ id: number; name: string; photo?: string; team?: { name?: string } }>>(
    "coachs", { search: q },
    { enabled: enabled && (filter === "all" || filter === "coaches"), select: (d) => d.response as never },
  );
  const stadiums = useFootball<Array<{ id: number; name: string; city?: string; country?: string; image?: string; capacity?: number }>>(
    "venues", { search: q },
    { enabled: enabled && (filter === "all" || filter === "stadiums"), select: (d) => d.response as never },
  );
  const countries = useFootball<Array<{ name: string; code?: string; flag?: string }>>(
    "countries", { search: q },
    { enabled: enabled && (filter === "all" || filter === "countries"), select: (d) => d.response as never },
  );

  const loading = enabled && (players.isLoading || teams.isLoading || leagues.isLoading || coaches.isLoading || stadiums.isLoading || countries.isLoading);
  const anyResults = useMemo(() =>
    (players.data?.length ?? 0) + (teams.data?.length ?? 0) + (leagues.data?.length ?? 0)
    + (coaches.data?.length ?? 0) + (stadiums.data?.length ?? 0) + (countries.data?.length ?? 0), [players.data, teams.data, leagues.data, coaches.data, stadiums.data, countries.data]);

  return (
    <AppShell>
      <div className="relative mx-auto max-w-3xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players, teams, competitions, coaches, stadiums, countries..."
          className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base outline-none focus:border-primary"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {!enabled && <EmptyState title="Type at least 3 characters to search" />}
        {enabled && loading && <div className="text-sm text-muted-foreground">Searching…</div>}
        {enabled && !loading && anyResults === 0 && <EmptyState title="No matches" description={`No results for "${q}"`} />}

        {(filter === "all" || filter === "players") && (players.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Players" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.data!.map((p) => (
                <Link key={p.player.id} to="/players/$id" params={{ id: String(p.player.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                  {p.player.photo && <img src={p.player.photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
                  <div><div className="font-medium">{p.player.name}</div><div className="text-xs text-muted-foreground">{p.player.nationality}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(filter === "all" || filter === "teams") && (teams.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Teams" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teams.data!.map((t) => (
                <Link key={t.team.id} to="/teams/$id" params={{ id: String(t.team.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                  {t.team.logo && <img src={t.team.logo} alt="" className="h-10 w-10 object-contain" />}
                  <div><div className="font-medium">{t.team.name}</div><div className="text-xs text-muted-foreground">{t.team.country}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(filter === "all" || filter === "competitions") && (leagues.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Competitions" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.data!.map((l) => (
                <Link key={l.league.id} to="/competitions/$id" params={{ id: String(l.league.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                  {l.league.logo && <img src={l.league.logo} alt="" className="h-10 w-10 object-contain" />}
                  <div><div className="font-medium">{l.league.name}</div><div className="text-xs text-muted-foreground">{l.country?.name}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(filter === "all" || filter === "coaches") && (coaches.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Coaches" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.data!.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  {c.photo && <img src={c.photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
                  <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.team?.name}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(filter === "all" || filter === "stadiums") && (stadiums.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Stadiums" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stadiums.data!.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.city}, {s.country} · Cap {s.capacity?.toLocaleString() ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(filter === "all" || filter === "countries") && (countries.data?.length ?? 0) > 0 && (
          <div>
            <SectionHeader title="Countries" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {countries.data!.map((c) => (
                <Link key={c.name} to="/countries/$name" params={{ name: c.name }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                  {c.flag && <img src={c.flag} alt="" className="h-6 w-8 object-cover" />}
                  <div className="font-medium">{c.name}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}