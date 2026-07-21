import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, SectionHeader } from "@/components/app-shell";
import { useFootball } from "@/lib/football";

export const Route = createFileRoute("/countries/$name")({
  head: ({ params }) => ({ meta: [
    { title: `${decodeURIComponent(params.name)} — Football | MansourAlmailScores` },
    { name: "description", content: `Teams, leagues and venues from ${decodeURIComponent(params.name)}.` },
  ] }),
  component: CountryPage,
});

type CountryInfo = { name: string; code?: string; flag?: string };
type TeamInfo = { team: { id: number; name: string; logo?: string; founded?: number; national?: boolean } };
type LeagueInfo = { league: { id: number; name: string; logo?: string; type: string } };
type VenueInfo = { id: number; name: string; city?: string; capacity?: number; image?: string };

function CountryPage() {
  const { name } = Route.useParams();
  const country = decodeURIComponent(name);

  const info = useFootball<CountryInfo | undefined>("countries", { name: country }, { select: (d) => d.response[0] as unknown as CountryInfo });
  const leagues = useFootball<LeagueInfo[]>("leagues", { country }, { select: (d) => d.response as unknown as LeagueInfo[] });
  const teams = useFootball<TeamInfo[]>("teams", { country }, { select: (d) => d.response as unknown as TeamInfo[] });
  const venues = useFootball<VenueInfo[]>("venues", { country }, { select: (d) => d.response as unknown as VenueInfo[] });

  const c = info.data;

  return (
    <AppShell>
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        {c?.flag && <img src={c.flag} alt="" className="h-16 w-24 object-cover" />}
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Country</div>
          <h1 className="text-3xl font-black">{c?.name ?? country}</h1>
          {c?.code && <div className="text-xs text-muted-foreground">Code: {c.code}</div>}
        </div>
      </div>

      <section className="mt-8">
        <SectionHeader title="Competitions" />
        {leagues.isLoading ? <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (leagues.data?.length ?? 0) === 0 ? <EmptyState title="No competitions listed" /> :
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.data!.map((l) => (
              <Link key={l.league.id} to="/competitions/$id" params={{ id: String(l.league.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {l.league.logo && <img src={l.league.logo} alt="" className="h-8 w-8 object-contain" />}
                <div><div className="font-medium">{l.league.name}</div><div className="text-xs text-muted-foreground">{l.league.type}</div></div>
              </Link>
            ))}
          </div>}
      </section>

      <section className="mt-8">
        <SectionHeader title="Teams" />
        {teams.isLoading ? <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (teams.data?.length ?? 0) === 0 ? <EmptyState title="No teams listed" /> :
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teams.data!.slice(0, 30).map((t) => (
              <Link key={t.team.id} to="/teams/$id" params={{ id: String(t.team.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {t.team.logo && <img src={t.team.logo} alt="" className="h-8 w-8 object-contain" />}
                <div><div className="font-medium">{t.team.name}</div><div className="text-xs text-muted-foreground">{t.team.national ? "National team" : t.team.founded ? `Est. ${t.team.founded}` : ""}</div></div>
              </Link>
            ))}
          </div>}
      </section>

      <section className="mt-8">
        <SectionHeader title="Stadiums" />
        {venues.isLoading ? <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (venues.data?.length ?? 0) === 0 ? <EmptyState title="No stadiums listed" /> :
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {venues.data!.slice(0, 30).map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-card p-3">
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-muted-foreground">{v.city} · Cap {v.capacity?.toLocaleString() ?? "—"}</div>
              </div>
            ))}
          </div>}
      </section>
    </AppShell>
  );
}