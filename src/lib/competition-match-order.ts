import { scheduleTime } from "./fixture-schedule";
type Fixture = { kickoff_at: string | null; kickoff_date?: string | null };
type TeamFixture = Fixture & { competition_id?: string | null; round_number?: number | null };
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