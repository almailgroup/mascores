/** Keep season filtering identical for club totals, fixtures and leaderboards. */
export function seasonIdentity(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\b(\d{2})\b/g, "20$1");
}

export function fixtureSeasons(fixtures: { season?: string | null }[]): string[] {
  return [...new Set(fixtures.map(m => m.season).filter((s): s is string => !!s))].sort((a, b) => seasonIdentity(b).localeCompare(seasonIdentity(a)));
}

export function seasonFixtures<T extends { season?: string | null }>(fixtures: T[], season: string): T[] {
  return fixtures.filter(m => seasonIdentity(m.season) === seasonIdentity(season));
}