import { supabase } from "@/lib/db";

/** One player's aggregated numbers inside a single competition and season. */
export type PlayerStat = {
  player_id: string;
  name: string;
  photo_url: string | null;
  team_id: string | null;
  team_name: string | null;
  team_logo: string | null;
  appearances: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  avg_rating: number | null;
};

/** One team's aggregated numbers inside a single competition and season. */
export type TeamStat = {
  team_id: string;
  name: string;
  logo_url: string | null;
  played: number;
  goals_for: number;
  goals_against: number;
  goals_per_match: number;
  avg_rating: number | null;
  avg_possession: number | null;
  avg_shots: number | null;
  yellow: number;
  red: number;
  clean_sheets: number;
};

export type CompetitionStats = { players: PlayerStat[]; teams: TeamStat[]; matches: number };

const FINISHED = new Set(["ft", "aet", "pen", "awarded"]);
const GOAL_TYPES = new Set(["goal", "penalty_goal", "penalty"]);

function num(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Everything the Stats tab shows, computed from matches, events, ratings and match statistics. */
export async function fetchCompetitionStats(competitionId: string, season: string | null): Promise<CompetitionStats> {
  let matchQuery = supabase
    .from("matches")
    .select("id,status,home_team_id,away_team_id,home_score,away_score")
    .eq("competition_id", competitionId);
  if (season) matchQuery = matchQuery.eq("season", season);
  const { data: rawMatches } = await matchQuery;
  const matches = (rawMatches ?? []).filter((m) => FINISHED.has(m.status));
  const ids = matches.map((m) => m.id);
  if (ids.length === 0) return { players: [], teams: [], matches: 0 };

  const [events, ratings, lineups, stats] = await Promise.all([
    supabase.from("match_events").select("match_id,type,team_id,player_id,assist_player_id").in("match_id", ids),
    supabase.from("player_ratings").select("match_id,player_id,rating").in("match_id", ids),
    supabase.from("match_lineups").select("match_id,team_id,player_id").in("match_id", ids),
    supabase.from("match_stats").select("match_id,label,home_value,away_value").in("match_id", ids),
  ]);

  const playerIds = new Set<string>();
  for (const row of lineups.data ?? []) playerIds.add(row.player_id);
  for (const row of events.data ?? []) {
    if (row.player_id) playerIds.add(row.player_id);
    if (row.assist_player_id) playerIds.add(row.assist_player_id);
  }
  for (const row of ratings.data ?? []) playerIds.add(row.player_id);

  const teamIds = new Set<string>();
  for (const m of matches) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }

  const [playersRes, teamsRes] = await Promise.all([
    playerIds.size
      ? supabase.from("players").select("id,name,photo_url,team_id").in("id", [...playerIds])
      : Promise.resolve({ data: [] as { id: string; name: string; photo_url: string | null; team_id: string | null }[] }),
    teamIds.size
      ? supabase.from("teams").select("id,name,logo_url").in("id", [...teamIds])
      : Promise.resolve({ data: [] as { id: string; name: string; logo_url: string | null }[] }),
  ]);
  const teamById = new Map((teamsRes.data ?? []).map((t) => [t.id, t]));

  // Which team each player represented in this competition (from lineups, falling back to his club).
  const playerTeam = new Map<string, string>();
  for (const row of lineups.data ?? []) if (row.team_id) playerTeam.set(row.player_id, row.team_id);
  for (const row of events.data ?? []) if (row.player_id && row.team_id && !playerTeam.has(row.player_id)) playerTeam.set(row.player_id, row.team_id);

  const appearances = new Map<string, Set<string>>();
  for (const row of lineups.data ?? []) {
    if (!appearances.has(row.player_id)) appearances.set(row.player_id, new Set());
    appearances.get(row.player_id)!.add(row.match_id);
  }

  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  const yellow = new Map<string, number>();
  const red = new Map<string, number>();
  const teamYellow = new Map<string, number>();
  const teamRed = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string | null | undefined) => { if (key) map.set(key, (map.get(key) ?? 0) + 1); };
  for (const e of events.data ?? []) {
    if (GOAL_TYPES.has(e.type)) { bump(goals, e.player_id); bump(assists, e.assist_player_id); }
    if (e.type === "assist") bump(assists, e.player_id);
    if (e.type === "yellow" || e.type === "second_yellow") { bump(yellow, e.player_id); bump(teamYellow, e.team_id); }
    if (e.type === "red" || e.type === "second_yellow") { bump(red, e.player_id); bump(teamRed, e.team_id); }
  }

  const ratingsByPlayer = new Map<string, number[]>();
  const ratingsByTeam = new Map<string, number[]>();
  for (const r of ratings.data ?? []) {
    const value = Number(r.rating);
    if (!Number.isFinite(value)) continue;
    if (!ratingsByPlayer.has(r.player_id)) ratingsByPlayer.set(r.player_id, []);
    ratingsByPlayer.get(r.player_id)!.push(value);
    const team = playerTeam.get(r.player_id);
    if (team) {
      if (!ratingsByTeam.has(team)) ratingsByTeam.set(team, []);
      ratingsByTeam.get(team)!.push(value);
    }
  }

  const possession = new Map<string, number[]>();
  const shots = new Map<string, number[]>();
  for (const s of stats.data ?? []) {
    const match = matches.find((m) => m.id === s.match_id);
    if (!match) continue;
    const label = s.label.toLowerCase();
    const target = label.includes("possession") ? possession : label.includes("shot") && !label.includes("target") ? shots : null;
    if (!target) continue;
    const home = num(s.home_value);
    const away = num(s.away_value);
    if (match.home_team_id && home != null) target.set(match.home_team_id, [...(target.get(match.home_team_id) ?? []), home]);
    if (match.away_team_id && away != null) target.set(match.away_team_id, [...(target.get(match.away_team_id) ?? []), away]);
  }

  const players: PlayerStat[] = (playersRes.data ?? []).map((p) => {
    const teamId = playerTeam.get(p.id) ?? p.team_id ?? null;
    const team = teamId ? teamById.get(teamId) : undefined;
    return {
      player_id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      team_id: teamId,
      team_name: team?.name ?? null,
      team_logo: team?.logo_url ?? null,
      appearances: appearances.get(p.id)?.size ?? 0,
      goals: goals.get(p.id) ?? 0,
      assists: assists.get(p.id) ?? 0,
      yellow: yellow.get(p.id) ?? 0,
      red: red.get(p.id) ?? 0,
      avg_rating: mean(ratingsByPlayer.get(p.id) ?? []),
    };
  }).filter((p) => p.appearances > 0 || p.goals > 0 || p.assists > 0 || p.avg_rating != null);

  const teams: TeamStat[] = [...teamIds].map((id) => {
    const own = matches.filter((m) => m.home_team_id === id || m.away_team_id === id);
    let gf = 0, ga = 0, cleanSheets = 0;
    for (const m of own) {
      const home = m.home_team_id === id;
      const scored = (home ? m.home_score : m.away_score) ?? 0;
      const conceded = (home ? m.away_score : m.home_score) ?? 0;
      gf += scored; ga += conceded;
      if (conceded === 0) cleanSheets += 1;
    }
    const team = teamById.get(id);
    return {
      team_id: id,
      name: team?.name ?? "—",
      logo_url: team?.logo_url ?? null,
      played: own.length,
      goals_for: gf,
      goals_against: ga,
      goals_per_match: own.length ? gf / own.length : 0,
      avg_rating: mean(ratingsByTeam.get(id) ?? []),
      avg_possession: mean(possession.get(id) ?? []),
      avg_shots: mean(shots.get(id) ?? []),
      yellow: teamYellow.get(id) ?? 0,
      red: teamRed.get(id) ?? 0,
      clean_sheets: cleanSheets,
    };
  }).filter((t) => t.played > 0);

  return { players, teams, matches: matches.length };
}
