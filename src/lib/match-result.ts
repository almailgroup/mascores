type Result = { status: string; home_score: number | null; away_score: number | null; home_pen: number | null; away_pen: number | null };
/** Shootouts decide winners without changing the match score. */
export function matchWinner(match: Result): "home" | "away" | null {
  const home = match.status === "pen" ? match.home_pen : match.home_score;
  const away = match.status === "pen" ? match.away_pen : match.away_score;
  if (home == null || away == null || home === away) return null;
  return home > away ? "home" : "away";
}
export function hasStandings(competition: { format?: string | null; hidden_tabs?: string[] | null } | null) {
  return !!competition && !["friendly", "knockout"].includes(competition.format ?? "") && !(competition.hidden_tabs ?? []).includes("standings");
}
