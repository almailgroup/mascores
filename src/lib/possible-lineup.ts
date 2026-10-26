export function possibleLineupWindow(status: string, kickoff: string | null, date: string | null, now = Date.now()) {
  if (status !== "scheduled") return false;
  const at = kickoff ? Date.parse(kickoff) : date ? Date.parse(`${date}T00:00:00Z`) : NaN;
  return Number.isFinite(at) && at > now && at - now <= 7 * 24 * 60 * 60 * 1000;
}