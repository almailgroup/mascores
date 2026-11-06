type Result = { status: string; home_score: number | null; away_score: number | null; home_pen: number | null; away_pen: number | null };
/** Shootouts decide winners without changing the match score. */
export function matchWinner(match: Result): "home" | "away" | null {
  const home = match.status === "pen" ? match.home_pen : match.home_score;
  const away = match.status === "pen" ? match.away_pen : match.away_score;
  if (home == null || away == null || home === away) return null;
  return home > away ? "home" : "away";
}
type HeadToHeadResult = { home_team_id: string | null; home_score: number | null; away_score: number | null };
/** Count every supplied meeting; club-history limits must not truncate this summary. */
export function headToHeadSummary(matches: HeadToHeadResult[], homeId: string) {
  let homeWins = 0, awayWins = 0, draws = 0;
  for (const match of matches) {
    if (match.home_score == null || match.away_score == null) continue;
    if (match.home_score === match.away_score) draws++;
    else if ((match.home_score > match.away_score) === (match.home_team_id === homeId)) homeWins++;
    else awayWins++;
  }
  return { homeWins, awayWins, draws, meetings: matches.length };
}

export function hasStandings(competition: { format?: string | null; hidden_tabs?: string[] | null } | null) {
  return !!competition && !["friendly", "knockout"].includes(competition.format ?? "") && !(competition.hidden_tabs ?? []).includes("standings");
}
