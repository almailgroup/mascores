import { scheduleTime } from "./fixture-schedule";
type Fixture = { kickoff_at: string | null; kickoff_date?: string | null };
type TeamFixture = Fixture & { competition_id?: string | null; season?: string | null; round_number?: number | null };
type RoundBucket = { round: string; matches: Fixture[]; order: number };

/** Postponed old rounds remain listed but cannot become the initial round. */
export function currentCompetitionRound<T extends { matches: (Fixture & { status: string })[] }>(rounds: T[]): T | undefined {
  return rounds.find(round => round.matches.some(match => ["live", "ht", "etwait", "interrupted"].includes(match.status)))
    ?? rounds.find(round => round.matches.some(match => match.status === "scheduled"))
    ?? rounds.at(-1);
}

function numberedRound(label: string) {
  const match = /^(#|round\s+|qualification\s+round\s+)(\d+)$/i.exec(label.trim());
  return match ? { stage: match[1].toLowerCase().replace(/^round\s+$/, "#"), number: Number(match[2]) } : null;
}

export function fixtureTime(fixture: Fixture) {
  return scheduleTime(fixture);
}

/** Round identity takes precedence over missing or rescheduled kickoff times. */
export function compareCompetitionRounds(a: RoundBucket, b: RoundBucket) {
  const ra = numberedRound(a.round);
  const rb = numberedRound(b.round);
  if (ra && rb && ra.stage === rb.stage && ra.number !== rb.number) return ra.number - rb.number;
  const dateA = Math.min(...a.matches.map(fixtureTime));
  const dateB = Math.min(...b.matches.map(fixtureTime));
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return 0;
}

/** Dated club fixtures use one chronological order across all competitions. */
export function compareTeamFixtures(a: TeamFixture, b: TeamFixture) {
  const timeA = fixtureTime(a);
  const timeB = fixtureTime(b);
  if (timeA === timeB) return 0;
  // Undated fixtures (Infinity) sink to the bottom of a newest-first list.
  if (!Number.isFinite(timeA)) return 1;
  if (!Number.isFinite(timeB)) return -1;
  return timeB - timeA;
}

/** Estimate only from dated rounds in the same competition and season. */
export function estimatedFixtureTime<T extends TeamFixture>(fixtures: T[], fixture: T): number {
  if (Number.isFinite(fixtureTime(fixture)) || !fixture.competition_id || fixture.round_number == null) return Infinity;
  const round = fixture.round_number;
  const peers = fixtures.filter((peer) => peer.competition_id === fixture.competition_id
    && peer.season === fixture.season && peer.round_number != null
    && Number.isFinite(fixtureTime(peer)));
  const before = peers.filter((peer) => (peer.round_number ?? 0) < round)
    .sort((a, b) => (b.round_number ?? 0) - (a.round_number ?? 0))[0];
  const after = peers.filter((peer) => (peer.round_number ?? 0) > round)
    .sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0))[0];
  if (before && after) {
    const low = before.round_number ?? round;
    const high = after.round_number ?? round;
    return fixtureTime(before) + (fixtureTime(after) - fixtureTime(before)) * (round - low) / (high - low);
  }
  if (before) return fixtureTime(before) + (round - (before.round_number ?? round)) * 86_400_000;
  if (after) return fixtureTime(after) - ((after.round_number ?? round) - round) * 86_400_000;
  return Infinity;
}

/** A display-only estimated calendar day; it never becomes a stored kickoff. */
export function estimatedFixtureDate<T extends TeamFixture>(fixtures: T[], fixture: T): string | null {
  const time = estimatedFixtureTime(fixtures, fixture);
  if (!Number.isFinite(time)) return null;
  const day = new Date(time);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** Keep undated rounds between nearby dated rounds without storing an invented kickoff. */
export function sortTeamFixtures<T extends TeamFixture>(fixtures: T[]): T[] {
  const anchored = fixtures.map((fixture, index) => {
    const actual = fixtureTime(fixture);
    const time = Number.isFinite(actual) ? actual : estimatedFixtureTime(fixtures, fixture);
    return { fixture, time, index };
  });
  anchored.sort((a, b) => {
    if (a.time === b.time) return a.index - b.index;
    if (!Number.isFinite(a.time)) return 1;
    if (!Number.isFinite(b.time)) return -1;
    return b.time - a.time;
  });
  return anchored.map(({ fixture }) => fixture);
}