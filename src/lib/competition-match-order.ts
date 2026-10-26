import { scheduleTime } from "./fixture-schedule";
type Fixture = { kickoff_at: string | null; kickoff_date?: string | null };
type TeamFixture = Fixture & { competition_id?: string | null; season?: string | null; round_number?: number | null };
type RoundBucket = { round: string; matches: Fixture[]; order: number };

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

/**
 * Give undated rounds a list-only anchor between nearby dated rounds, then sort
 * every fixture by a single key. Never turn this anchor into a displayed kickoff.
 * Pairwise round/date comparisons are not transitive across competitions.
 */
export function sortTeamFixtures<T extends TeamFixture>(fixtures: T[]): T[] {
  const anchored = fixtures.map((fixture, index) => {
    let time = fixtureTime(fixture);
    const round = fixture.round_number;
    if (!Number.isFinite(time) && fixture.competition_id && round != null) {
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
        time = fixtureTime(before) + (fixtureTime(after) - fixtureTime(before)) * (round - low) / (high - low);
      } else if (before) {
        time = fixtureTime(before) + round - (before.round_number ?? round);
      } else if (after) {
        time = fixtureTime(after) - ((after.round_number ?? round) - round);
      }
    }
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