/** Calendar dates follow the device's timezone, just like match kickoffs. */
export const DEFAULT_MATCH_VIEW = "upcoming" as const;

export function matchDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function upcomingStart(day: Date, now = new Date()): string {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return new Date(Math.max(start.getTime(), now.getTime())).toISOString();
}

export function matchDates(fixtures: { kickoff_at: string | null }[]): Set<string> {
  return new Set(fixtures.flatMap(({ kickoff_at }) => {
    if (!kickoff_at) return [];
    const date = new Date(kickoff_at);
    return Number.isNaN(date.getTime()) ? [] : [matchDateKey(date)];
  }));
}