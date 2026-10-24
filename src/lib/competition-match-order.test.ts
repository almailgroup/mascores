import { describe, expect, it } from "vitest";
import { compareCompetitionRounds, fixtureTime } from "./competition-match-order";

const bucket = (round: number, kickoff: string | null) => ({ round: `#${round}`, matches: [{ kickoff_at: kickoff }], order: 0 });

describe("competition round placement", () => {
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