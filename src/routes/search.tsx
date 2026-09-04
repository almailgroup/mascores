import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import logoLight from "@/assets/logo-mark-v2.png.asset.json";
import logoDark from "@/assets/logo-mark-dark.png";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState } from "@/components/app-shell";
import { supabase } from "@/lib/db";
import { FlagIcon } from "@/components/flag";
import { Search as SearchIcon, Trophy, Shield, User, Building2, Clock, X, ArrowLeft } from "lucide-react";
import { useReverseTranslate, useTx } from "@/lib/auto-translate";
import { COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

type Filter = "all" | "clubs" | "competitions" | "players" | "coaches" | "venues";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "clubs", label: "Teams" },
  { key: "competitions", label: "Competitions" },
  { key: "players", label: "Players" },
  { key: "coaches", label: "Coaches" },
  { key: "venues", label: "Stadiums" },
];

const HISTORY_KEY = "mas.search.visited";

/** A result the user actually opened — stored so they can jump straight back to it. */
type Visited = { key: string; label: string; kind: Filter; to: string; params: Record<string, string>; logo?: string | null };

function readHistory(): Visited[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as Visited[]).filter((v) => v && typeof v.key === "string" && typeof v.to === "string").slice(0, 12) : [];
  } catch { return []; }
}

function SearchPage() {
  const tx = useTx();
  const router = useRouter();
  const reverse = useReverseTranslate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [history, setHistory] = useState<Visited[]>([]);
  useEffect(() => { setHistory(readHistory()); }, []);
  const writeHistory = (next: Visited[]) => {
    setHistory(next);
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const remember = (entry: Visited) => writeHistory([entry, ...readHistory().filter((item) => item.key !== entry.key)].slice(0, 12));
  const terms = [q.trim(), ...(/[\u0600-\u06FF]/.test(q) ? reverse(q) : [])].filter((t) => t.length > 1);
  const orFilter = (columns: string[]) =>
    columns.flatMap((col) => terms.map((t) => `${col}.ilike.%${t.replace(/[,()]/g, " ")}%`)).join(",");
  /** Countries whose English or Arabic name matches the query — used to surface their competitions. */
  const matchedCountries = COUNTRIES.filter((c) =>
    terms.some((t) => c.name.toLowerCase().includes(t.toLowerCase()) || c.nameAr.includes(t)),
  ).slice(0, 4);
  const compFilter = [
    orFilter(["name", "country"]),
    ...matchedCountries.map((c) => `country_code.eq.${c.code}`),
  ].filter(Boolean).join(",");
  const res = useQuery({
    enabled: q.length > 1,
    queryKey: ["search", q, terms.join("|"), matchedCountries.map((c) => c.code).join("|")],
    queryFn: async () => {
      // Typo-tolerant matches (trigram similarity) so "sluaibkhat" still finds "Sulaibikhat".
      const fuzzy = await supabase.rpc("fuzzy_search", { _q: terms[0] ?? q.trim(), _limit: 40 });
      const idsOf = (kind: string) => (fuzzy.data ?? []).filter((r) => r.kind === kind).map((r) => r.id);
      const fuzzyIn = <T,>(ids: string[], run: (ids: string[]) => PromiseLike<{ data: T[] | null }>) =>
        ids.length ? run(ids) : Promise.resolve({ data: [] as T[] });
      const merge = <T extends { id: string }>(a: T[] | null, b: T[] | null) => {
        const out = [...(a ?? [])];
        for (const row of b ?? []) if (!out.some((r) => r.id === row.id)) out.push(row);
        return out;
      };

      const teamCols = "id,name,short_name,country,country_code,logo_url";
      const playerCols = "id,name,position,photo_url,nationality,nationality_code,team:team_id(id,name,logo_url)";
      const compCols = "id,slug,name,country,country_code,logo_url,season";
      const coachCols = "id,name,nationality,nationality_code,photo_url,team:team_id(id,name,logo_url)";
      const venueCols = "id,name,city,country";

      const [teams, players, comps, coaches, venues, fTeams, fPlayers, fComps, fCoaches, fVenues] = await Promise.all([
        supabase.from("teams").select(teamCols).or(orFilter(["name", "short_name"])).limit(20),
        supabase.from("players").select(playerCols).or(orFilter(["name"])).limit(20),
        supabase.from("competitions").select(compCols).or(compFilter).limit(30),
        supabase.from("coaches").select(coachCols).or(orFilter(["name"])).limit(20),
        supabase.from("venues").select(venueCols).or(orFilter(["name", "city"])).limit(20),
        fuzzyIn(idsOf("team"), (ids) => supabase.from("teams").select(teamCols).in("id", ids)),
        fuzzyIn(idsOf("player"), (ids) => supabase.from("players").select(playerCols).in("id", ids)),
        fuzzyIn(idsOf("competition"), (ids) => supabase.from("competitions").select(compCols).in("id", ids)),
        fuzzyIn(idsOf("coach"), (ids) => supabase.from("coaches").select(coachCols).in("id", ids)),
        fuzzyIn(idsOf("venue"), (ids) => supabase.from("venues").select(venueCols).in("id", ids)),
      ]);
      return {
        teams: merge(teams.data, fTeams.data as typeof teams.data),
        players: merge(players.data, fPlayers.data as typeof players.data) as unknown as { id: string; name: string; position: string | null; photo_url: string | null; nationality: string | null; nationality_code: string | null; team: { id: string; name: string; logo_url: string | null } | null }[],
        comps: merge(comps.data, fComps.data as typeof comps.data),
        coaches: merge(coaches.data, fCoaches.data as typeof coaches.data) as unknown as { id: string; name: string; nationality: string | null; nationality_code: string | null; photo_url: string | null; team: { id: string; name: string; logo_url: string | null } | null }[],
        venues: merge(venues.data, fVenues.data as typeof venues.data),
      };
    },
  });

  const show = (k: Filter) => filter === "all" || filter === k;
  const total = res.data
    ? res.data.teams.length + res.data.players.length + res.data.comps.length + res.data.coaches.length + res.data.venues.length
    : 0;

  return (
    <AppShell>
      {/* Focused search surface: two-tone brand header (black→blue in light mode,
          white→blue in dark mode) with the logo set as a faint watermark. */}
      <div className="relative -mx-4 -mt-4 mb-4 sticky top-0 z-30 overflow-hidden bg-gradient-to-r from-[#0b0f1a] to-primary px-4 pb-3 pt-4 text-white shadow-lg dark:from-white dark:to-primary dark:text-[#0b0f1a] sm:rounded-b-3xl">
        <img src={logoLight.url} alt="" aria-hidden className="pointer-events-none absolute -end-6 -top-6 h-32 w-32 opacity-10 dark:hidden" />
        <img src={logoDark} alt="" aria-hidden className="pointer-events-none absolute -end-6 -top-6 hidden h-32 w-32 opacity-15 dark:block" />
        <div className="relative flex items-center gap-2">
          <button type="button" aria-label={tx("Back")} onClick={() => { if (router.history.canGoBack()) router.history.back(); else void router.navigate({ to: "/" }); }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/20 dark:hover:bg-black/10">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-4 text-foreground shadow-sm">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={tx("Search")}
              className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
            {q && <button aria-label={tx("Clear")} onClick={() => setQ("")} className="text-muted-foreground"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="relative mt-3 flex gap-2 overflow-x-auto pb-0.5 text-xs">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-bold transition ${filter === f.key ? "bg-card text-primary shadow-sm" : "bg-white/15 text-white/90 dark:bg-black/10 dark:text-[#0b0f1a]/80"}`}>
              {tx(f.label)}
            </button>
          ))}
        </div>
      </div>


      {history.length > 0 && q.length < 2 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {tx("Recently viewed")}</span>
            <button className="text-destructive" onClick={() => writeHistory([])}>{tx("Clear all")}</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {history.map((item) => (
              <div key={item.key} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0">
                <Link to={item.to as never} params={item.params as never} className="flex min-w-0 flex-1 items-center gap-3">
                  {item.logo
                    ? <img src={item.logo} alt="" className="h-9 w-9 shrink-0 rounded-full bg-muted object-contain p-0.5" />
                    : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-[0.7rem] font-black">{item.label.slice(0, 1).toUpperCase()}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{tx(item.label)}</span>
                    <span className="block truncate text-[0.7rem] capitalize text-muted-foreground">{tx(FILTERS.find((f) => f.key === item.kind)?.label ?? "")}</span>
                  </span>
                </Link>
                <button aria-label={`Remove ${item.label}`} onClick={() => writeHistory(history.filter((h) => h.key !== item.key))} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {q.length < 2 ? <EmptyState title={tx("Type to search")} /> : !res.data ? null : total === 0 ? <EmptyState title={tx("No results")} /> : (
        <div className="space-y-6">
          {show("competitions") && (
            <Group title={tx("Competitions")}>{res.data.comps.map((c) => (
              <ResultRow key={c.id} to="/competitions/$slug" params={{ slug: c.slug }}
                logo={c.logo_url} fallback={<Trophy className="h-4 w-4 text-muted-foreground" />}
                title={tx(c.name)} country={c.country_code ?? c.country} sub={[tx(c.country), c.season].filter(Boolean).join(" · ")}
                onOpen={() => remember({ key: `comp:${c.id}`, label: c.name, kind: "competitions", to: "/competitions/$slug", params: { slug: c.slug }, logo: c.logo_url })} />
            ))}</Group>
          )}
          {show("clubs") && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{tx("Teams")}</h2>
              <div className="space-y-3">
                {res.data.teams.map((tm) => (
                  <div key={tm.id} className="space-y-2">
                    <ResultRow to="/teams/$id" params={{ id: tm.id }}
                      logo={tm.logo_url} fallback={<Shield className="h-4 w-4 text-muted-foreground" />}
                      title={tx(tm.name)} country={tm.country_code ?? tm.country} sub={tx(tm.country) ?? tm.short_name ?? ""}
                      onOpen={() => remember({ key: `team:${tm.id}`, label: tm.name, kind: "clubs", to: "/teams/$id", params: { id: tm.id }, logo: tm.logo_url })} />
                    <TeamSquadResults teamId={tm.id} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {show("players") && (
            <Group title={tx("Players")}>{res.data.players.map((p) => (
              <ResultRow key={p.id} to="/players/$id" params={{ id: p.id }} round
                logo={p.photo_url} fallback={<User className="h-4 w-4 text-muted-foreground" />}
                title={tx(p.name)} country={p.nationality_code ?? p.nationality}
                sub={[tx(p.team?.name), tx(p.position)].filter(Boolean).join(" · ")}
                onOpen={() => remember({ key: `player:${p.id}`, label: p.name, kind: "players", to: "/players/$id", params: { id: p.id }, logo: p.photo_url })} />
            ))}</Group>
          )}
          {show("coaches") && (
            <Group title={tx("Coaches")}>{res.data.coaches.map((c) => (
              <ResultRow key={c.id} to={c.team ? "/teams/$id" : "/search"} params={c.team ? { id: c.team.id } : {}} round
                logo={c.photo_url} fallback={<User className="h-4 w-4 text-muted-foreground" />}
                title={tx(c.name)} country={c.nationality_code ?? c.nationality}
                sub={[tx(c.team?.name), tx("Coach")].filter(Boolean).join(" · ")} />
            ))}</Group>
          )}
          {show("venues") && (
            <Group title={tx("Stadiums")}>{res.data.venues.map((v) => (
              <ResultRow key={v.id} to="/search" params={{}}
                logo={null} fallback={<Building2 className="h-4 w-4 text-muted-foreground" />}
                title={tx(v.name)} country={v.country} sub={[tx(v.city), tx(v.country)].filter(Boolean).join(", ")} />
            ))}</Group>
          )}
        </div>
      )}
    </AppShell>
  );
}

function ResultRow({ to, params, logo, fallback, title, sub, country, round, onOpen }: {
  to: string; params: Record<string, string>; logo: string | null | undefined;
  fallback: React.ReactNode; title: string; sub?: string; country?: string | null; round?: boolean; onOpen?: () => void;
}) {
  return (
    <Link to={to as never} params={params as never} onClick={onOpen}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/50">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden ${round ? "rounded-full" : "rounded-xl"} border border-border bg-muted/40`}>
        {logo ? <img src={logo} alt="" className={`h-full w-full ${round ? "object-cover" : "object-contain p-1"}`} /> : fallback}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FlagIcon value={country} size="xs" />
          <span className="truncate">{sub || "—"}</span>
        </div>
      </div>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const tx = useTx();
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{tx(title)}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** The squad of a matched team, so searching a club also surfaces its players. */
function TeamSquadResults({ teamId }: { teamId: string }) {
  const tx = useTx();
  const squad = useQuery({
    queryKey: ["search-squad", teamId],
    queryFn: async () => {
      const club = await supabase.from("players").select("id,name,position,shirt_number,photo_url").eq("team_id", teamId).order("shirt_number", { nullsFirst: false }).limit(40);
      if ((club.data ?? []).length > 0) return club.data ?? [];
      const calls = await supabase.from("national_team_players").select("player_id,shirt_number,photo_url,position").eq("team_id", teamId).limit(40);
      const ids = (calls.data ?? []).map((c) => c.player_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("players").select("id,name,position,shirt_number,photo_url").in("id", ids);
      return (data ?? []).map((p) => {
        const call = (calls.data ?? []).find((c) => c.player_id === p.id)!;
        return { ...p, shirt_number: call.shirt_number ?? p.shirt_number, photo_url: call.photo_url ?? p.photo_url, position: call.position ?? p.position };
      });
    },
  });

  if (!squad.data || squad.data.length === 0) return null;
  return (
    <div className="ms-3 grid gap-1.5 border-s border-border ps-3 sm:grid-cols-2 lg:grid-cols-3">
      {squad.data.map((p) => (
        <Link key={p.id} to="/players/$id" params={{ id: p.id }}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-2.5 py-2 hover:border-primary/50">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 text-[0.6rem] font-bold">
            {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : (p.shirt_number ?? "")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{tx(p.name)}</span>
            <span className="block truncate text-[0.6rem] text-muted-foreground">{[p.shirt_number != null ? `#${p.shirt_number}` : null, tx(p.position)].filter(Boolean).join(" · ")}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}