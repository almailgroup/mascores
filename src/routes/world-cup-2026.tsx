import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFootball, LEAGUES, WC_SEASON } from "@/lib/football";
import { FavoriteButton } from "@/hooks/use-favorites";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/world-cup-2026")({
  head: () => ({ meta: [
    { title: "FIFA World Cup 2026 — MansourAlmailScores" },
    { name: "description", content: "Full coverage of the FIFA World Cup 2026: groups, fixtures, standings, and knockout stages." },
    { property: "og:title", content: "FIFA World Cup 2026 Hub" },
    { property: "og:description", content: "Groups, fixtures, standings and the road to the final." },
    { property: "og:type", content: "website" },
  ] }),
  component: WorldCupHub,
});

type Standing = { rank: number; team: { id: number; name: string; logo?: string }; points: number; goalsDiff: number; group?: string; all: { played: number; win: number; draw: number; lose: number } };

function WorldCupHub() {
  const standings = useFootball<Standing[][]>("standings", { league: LEAGUES.WORLD_CUP, season: WC_SEASON }, {
    select: (d) => {
      const first = d.response[0] as { league?: { standings?: Standing[][] } } | undefined;
      return first?.league?.standings ?? [];
    },
  });
  const fixtures = useFootball<Fixture[]>("fixtures", { league: LEAGUES.WORLD_CUP, season: WC_SEASON }, {
    select: (d) => d.response as unknown as Fixture[],
  });

  const knockoutRounds = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "3rd Place Final", "Final"];
  const byRound = new Map<string, Fixture[]>();
  for (const f of fixtures.data ?? []) {
    const r = f.league.round ?? "Group Stage";
    byRound.set(r, [...(byRound.get(r) ?? []), f]);
  }

  return (
    <AppShell>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card to-card p-8">
        <Trophy className="absolute -right-8 -top-8 h-48 w-48 text-primary/10" />
        <div className="relative">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Summer 2026 · USA · Canada · Mexico</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">FIFA World Cup 2026</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            The biggest World Cup ever — 48 nations, three host countries, one trophy. Follow every group, every knockout round, and every unforgettable moment.
          </p>
          <div className="mt-4"><FavoriteButton kind="competition" id={LEAGUES.WORLD_CUP} size="md" /></div>
        </div>
      </div>

      <section className="mt-10">
        <SectionHeader title="Groups" />
        {standings.isLoading ? <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (standings.data?.length ?? 0) === 0 ? <EmptyState title="Groups will appear when the draw is finalized." /> :
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {standings.data!.map((group, gi) => (
              <div key={gi} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary">Group {group[0]?.group ?? String.fromCharCode(65 + gi)}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {group.map((row) => (
                      <tr key={row.team.id} className="border-t border-border/60">
                        <td className="p-2 pl-3 font-medium">{row.rank}</td>
                        <td className="p-2">
                          <Link to="/teams/$id" params={{ id: String(row.team.id) }} className="flex items-center gap-2 hover:text-primary">
                            {row.team.logo && <img src={row.team.logo} alt="" className="h-4 w-4" />}
                            <span className="truncate">{row.team.name}</span>
                          </Link>
                        </td>
                        <td className="p-2 text-center text-muted-foreground">{row.all.played}</td>
                        <td className="p-2 pr-3 text-center font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>}
      </section>

      <section className="mt-10">
        <SectionHeader title="Knockouts" />
        <div className="space-y-6">
          {knockoutRounds.map((r) => {
            const games = byRound.get(r);
            if (!games || games.length === 0) return null;
            return (
              <div key={r}>
                <div className="mb-2 text-sm font-bold uppercase tracking-widest text-primary">{r}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {games.map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
                </div>
              </div>
            );
          })}
          {!knockoutRounds.some((r) => byRound.get(r)?.length) && <EmptyState title="Knockout schedule will appear once the group stage concludes." />}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title="All fixtures" />
        {fixtures.isLoading ? <LoadingSkeleton /> :
          (fixtures.data?.length ?? 0) === 0 ? <EmptyState title="Fixture list will publish soon." /> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixtures.data!.slice(0, 24).map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
          </div>}
      </section>
    </AppShell>
  );
}