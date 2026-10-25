import { describe, expect, it } from "vitest";
import { compareCompetitionRounds, compareTeamFixtures, fixtureTime } from "./competition-match-order";

const bucket = (round: number, kickoff: string | null) => ({ round: `#${round}`, matches: [{ kickoff_at: kickoff }], order: 0 });

describe("competition round placement", () => {
  it("orders the admin Round labels numerically with postponed fixtures last within their own round", () => {
    const rounds = [
      { round: "Round 5", matches: [{ kickoff_at: null }], order: 0 },
      { round: "Round 10", matches: [{ kickoff_at: "2026-11-29T14:00:00Z" }], order: 1 },
      { round: "Round 1", matches: [{ kickoff_at: "2026-08-25T15:45:00Z" }], order: 2 },
      { round: "Round 7", matches: [{ kickoff_at: null }], order: 3 },
    ].sort(compareCompetitionRounds);
    expect(rounds.map((r) => r.round)).toEqual(["Round 1", "Round 5", "Round 7", "Round 10"]);
  });
  it("keeps Round 5 after Round 1 when Round 5 contains a TBD fixture", () => {
    const rounds = [bucket(5, null), bucket(1, "2026-08-25T17:00:00Z")].sort(compareCompetitionRounds);
    expect(rounds.map((r) => r.round)).toEqual(["#1", "#5"]);
  });
  it("keeps every fully TBD round in its numbered position", () => {
    const rounds = [bucket(6, null), bucket(5, null), bucket(2, null), bucket(1, null)].sort(compareCompetitionRounds);
    expect(rounds.map((r) => r.round)).toEqual(["#1", "#2", "#5", "#6"]);
  });
  it("keeps a rescheduled Round 5 before Round 6", () => {
    const rounds = [bucket(6, "2026-10-24T17:00:00Z"), bucket(5, "2026-12-17T17:00:00Z")].sort(compareCompetitionRounds);
    expect(rounds.map((r) => r.round)).toEqual(["#5", "#6"]);
  });
  it("does not turn a missing kickoff into the first date in a round", () => {
    expect(fixtureTime({ kickoff_at: null })).toBe(Infinity);
    expect(fixtureTime({ kickoff_at: "2026-10-18T17:00:00Z" })).toBe(Date.parse("2026-10-18T17:00:00Z"));
  });
});

describe("club fixture ordering", () => {
  const fx = (round: number, kickoff: string | null, date: string | null = null) =>
    ({ competition_id: "league", round_number: round, kickoff_at: kickoff, kickoff_date: date });
  it("keeps a TBD round 7 after round 6 and before round 8 in a newest-first club list", () => {
    const list = [fx(6, null, "2026-11-30"), fx(8, "2026-12-14T17:00:00Z"), fx(7, null), fx(5, "2026-11-20T17:00:00Z")]
      .sort(compareTeamFixtures);
    expect(list.map((m) => m.round_number)).toEqual([8, 7, 6, 5]);
  });
  it("keeps a postponed fixture in its own round instead of sinking to the bottom", () => {
    const list = [fx(7, null), fx(6, "2026-11-30T17:00:00Z"), fx(1, "2026-08-25T15:45:00Z")].sort(compareTeamFixtures);
    expect(list.map((m) => m.round_number)).toEqual([7, 6, 1]);
  });
  it("still orders different competitions by date with undated fixtures last", () => {
    const list = [
      { competition_id: "cup", round_number: null, kickoff_at: null },
      { competition_id: "league", round_number: 6, kickoff_at: "2026-11-30T17:00:00Z" },
    ].sort(compareTeamFixtures);
    expect(list[0].competition_id).toBe("league");
  });
});