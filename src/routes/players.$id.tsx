import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, SectionHeader } from "@/components/app-shell";
import { useFootball, CLUB_SEASON } from "@/lib/football";
import { FavoriteButton } from "@/hooks/use-favorites";

export const Route = createFileRoute("/players/$id")({
  head: ({ params }) => ({ meta: [
    { title: `Player #${params.id} — MansourAlmailScores` },
    { name: "description", content: "Player profile: biography, stats, and current team." },
  ] }),
  component: PlayerPage,
});

type PlayerData = {
  player: { id: number; name: string; firstname?: string; lastname?: string; age?: number; nationality?: string; height?: string; weight?: string; photo?: string; birth?: { date?: string; place?: string; country?: string } };
  statistics: Array<{
    team: { id: number; name: string; logo?: string };
    league: { id: number; name: string; logo?: string; season?: number };
    games: { appearences?: number | null; lineups?: number | null; minutes?: number | null; position?: string | null; rating?: string | null };
    goals: { total?: number | null; assists?: number | null };
    cards: { yellow?: number | null; red?: number | null };
  }>;
};

function PlayerPage() {
  const { id } = Route.useParams();
  const playerId = Number(id);

  const res = useFootball<PlayerData | undefined>("players", { id: playerId, season: CLUB_SEASON }, {
    select: (d) => d.response[0] as unknown as PlayerData,
  });

  const p = res.data?.player;
  const stats = res.data?.statistics ?? [];
  const primary = stats[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        {p?.photo && <img src={p.photo} alt="" className="h-24 w-24 rounded-full object-cover" />}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{p?.nationality} {p?.age ? `· Age ${p.age}` : ""}</div>
          <h1 className="text-3xl font-black">{p?.name ?? `Player ${playerId}`}</h1>
          {primary?.team && (
            <Link to="/teams/$id" params={{ id: String(primary.team.id) }} className="mt-1 inline-flex items-center gap-2 text-sm hover:text-primary">
              {primary.team.logo && <img src={primary.team.logo} alt="" className="h-5 w-5" />}
              {primary.team.name}
            </Link>
          )}
          {p?.birth?.date && <div className="mt-1 text-xs text-muted-foreground">Born {p.birth.date}{p.birth.place ? `, ${p.birth.place}` : ""}</div>}
          {(p?.height || p?.weight) && <div className="text-xs text-muted-foreground">{p?.height} · {p?.weight}</div>}
        </div>
        <FavoriteButton kind="player" id={playerId} size="md" />
      </div>

      <section className="mt-8">
        <SectionHeader title="Season stats" />
        {res.isLoading ? <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          stats.length === 0 ? <EmptyState title="No stats available for this season" /> :
          <div className="grid gap-3 md:grid-cols-2">
            {stats.map((s, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  {s.league.logo && <img src={s.league.logo} alt="" className="h-5 w-5" />}
                  <div className="font-semibold">{s.league.name}</div>
                  <div className="ml-auto text-xs text-muted-foreground">{s.team.name}</div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Apps" value={s.games.appearences ?? 0} />
                  <Stat label="Goals" value={s.goals.total ?? 0} />
                  <Stat label="Assists" value={s.goals.assists ?? 0} />
                  <Stat label="Minutes" value={s.games.minutes ?? 0} />
                  <Stat label="Yellows" value={s.cards.yellow ?? 0} />
                  <Stat label="Reds" value={s.cards.red ?? 0} />
                </dl>
                {s.games.rating && <div className="mt-3 text-center text-xs text-muted-foreground">Rating: <span className="font-bold text-primary">{Number(s.games.rating).toFixed(2)}</span></div>}
              </div>
            ))}
          </div>}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}