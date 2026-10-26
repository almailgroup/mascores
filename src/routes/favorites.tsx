import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { MatchGroups, type MatchWithTeams } from "@/components/match-list";
import { TeamCrest } from "@/components/team-crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { useFavorites } from "@/hooks/use-favorites";
import { supabase, type Competition, type Player, type Team } from "@/lib/db";
import { useTx } from "@/lib/auto-translate";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [
    { title: "Favorites — MaScores" },
    { name: "description", content: "Your saved matches, clubs, players and competitions." },
    { property: "og:title", content: "Favorites — MaScores" },
    { property: "og:description", content: "Your saved matches, clubs, players and competitions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const tx = useTx();
  const { favorites, ready } = useFavorites();
  const [club, setClub] = useState<string | null>(null);
  const [view, setView] = useState<"matches" | "clubs" | "competitions" | "players">("matches");
  const matches = useQuery({
    enabled: ready && (favorites.match.length > 0 || favorites.team.length > 0),
    queryKey: ["favorites-page-matches", favorites.match.join(","), favorites.team.join(",")],
    queryFn: async () => {
      // Starred matches plus every fixture of a favourite club.
      const sel = "*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)";
      const ors = [favorites.match.length ? `id.in.(${favorites.match.join(",")})` : "", favorites.team.length ? `home_team_id.in.(${favorites.team.join(",")})` : "", favorites.team.length ? `away_team_id.in.(${favorites.team.join(",")})` : ""].filter(Boolean).join(",");
      const { data } = await supabase.from("matches").select(sel).or(ors).order("kickoff_at").limit(300);
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });
  const teams = useQuery({ enabled: ready && favorites.team.length > 0, queryKey: ["favorites-page-teams", favorites.team.join(",")], queryFn: async () => ((await supabase.from("teams").select("*").in("id", favorites.team)).data ?? []) as Team[] });
  const players = useQuery({ enabled: ready && favorites.player.length > 0, queryKey: ["favorites-page-players", favorites.player.join(",")], queryFn: async () => ((await supabase.from("players").select("*").in("id", favorites.player)).data ?? []) as Player[] });
  const competitions = useQuery({ enabled: ready && favorites.competition.length > 0, queryKey: ["favorites-page-competitions", favorites.competition.join(",")], queryFn: async () => ((await supabase.from("competitions").select("*").in("id", favorites.competition)).data ?? []) as Competition[] });
  if (!ready) return <AppShell><LoadingSkeleton /></AppShell>;

  const tabs = [
    { key: "matches", label: "Matches" },
    { key: "clubs", label: "Clubs" },
    { key: "competitions", label: "Competitions" },
    { key: "players", label: "Players" },
  ] as const;
  const row = "flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary";
  const empty = (label: string) => <EmptyState title={tx(label)} />;
  return <AppShell>
    <h1 className="mb-5 text-xl font-bold">{tx("Favorites")}</h1>
    <div data-no-gesture role="tablist" aria-label={tx("Favorites")} className="mb-5 grid grid-cols-[1fr_0.8fr_1.45fr_1fr] border-b border-border">
      {tabs.map((tab) => (
        <Button variant="ghost" role="tab" aria-selected={view === tab.key} key={tab.key} onClick={() => setView(tab.key)}
          className={`-mb-px h-11 min-w-0 rounded-none border-b-2 px-0 text-xs font-semibold transition ${view === tab.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          {tx(tab.label)}
        </Button>
      ))}
    </div>
    {view === "matches" && teams.data && teams.data.length > 0 && <div data-no-gesture className="mb-4 flex gap-2 overflow-x-auto pb-1">
      <Button variant={club ? "outline" : "default"} size="sm" className="shrink-0 rounded-full" onClick={() => setClub(null)}>{tx("All")}</Button>
      {teams.data.map((team) => <Button key={team.id} variant={club === team.id ? "default" : "outline"} size="sm" className="shrink-0 gap-1.5 rounded-full" onClick={() => setClub(club === team.id ? null : team.id)}><TeamCrest name={team.name} logo={team.logo_url} className="h-4 w-4" />{tx(team.name)}</Button>)}
    </div>}
    {view === "matches" && (() => { const list = (matches.data ?? []).filter((m) => !club || m.home_team_id === club || m.away_team_id === club); return matches.isLoading ? <LoadingSkeleton /> : list.length ? <MatchGroups data={list} /> : empty("No favorite matches yet"); })()}
    {view === "clubs" && (teams.isLoading ? <LoadingSkeleton /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {teams.data?.map((team) => <Link key={team.id} to="/teams/$id" params={{ id: team.id }} className={row}><TeamCrest name={team.name} logo={team.logo_url} className="h-10 w-10" /><span className="min-w-0 flex-1 truncate font-semibold">{tx(team.name)}</span></Link>)}
      {!teams.data?.length && empty("No favorite teams yet")}
    </div>)}
    {view === "competitions" && (competitions.isLoading ? <LoadingSkeleton /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {competitions.data?.map((competition) => <Link key={competition.id} to="/competitions/$slug" params={{ slug: competition.slug }} className={row}>{competition.logo_url ? <img src={competition.logo_url} alt="" className="h-10 w-10 object-contain" /> : <Trophy className="h-8 w-8 text-primary" />}<span className="min-w-0 flex-1 truncate font-semibold">{tx(competition.name)}</span></Link>)}
      {!competitions.data?.length && empty("No favorite competitions yet")}
    </div>)}
    {view === "players" && (players.isLoading ? <LoadingSkeleton /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {players.data?.map((player) => <Link key={player.id} to="/players/$id" params={{ id: player.id }} className={row}><PlayerAvatar src={player.photo_url} name={player.name} /><span className="min-w-0 flex-1 truncate font-semibold">{tx(player.name)}</span></Link>)}
      {!players.data?.length && empty("No favorite players yet")}
    </div>)}
  </AppShell>;
}
