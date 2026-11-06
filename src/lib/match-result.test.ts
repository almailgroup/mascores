import { describe, expect, it } from "vitest";
import { hasStandings, headToHeadSummary, matchWinner } from "./match-result";
describe("cup results", () => {
  it("recognizes Khaitan as the 3–1 shootout winner of a 1–1 match", () => {
    expect(matchWinner({ status: "pen", home_score: 1, away_score: 1, home_pen: 1, away_pen: 3 })).toBe("away");
  });
  it("does not infer an unknown shootout winner", () => {
    expect(matchWinner({ status: "pen", home_score: 1, away_score: 1, home_pen: null, away_pen: null })).toBeNull();
  });
  it("removes standings from knockout cups", () => {
    expect(hasStandings({ format: "knockout" })).toBe(false);
    expect(hasStandings({ format: "league" })).toBe(true);
  });
  it("honors hidden standings on match pages too", () => {
    expect(hasStandings({ format: "cup", hidden_tabs: ["standings"] })).toBe(false);
  });
  it("counts all 80 Al Qadsia–Kuwait meetings without a club-history cutoff", () => {
    const meetings = Array.from({ length: 80 }, (_, index) => ({
      home_team_id: index % 2 ? "kuwait" : "qadsia",
      home_score: index % 3,
      away_score: (index + 1) % 3,
    }));
    expect(headToHeadSummary(meetings, "qadsia").meetings).toBe(80);
    expect(headToHeadSummary(meetings, "qadsia").homeWins + headToHeadSummary(meetings, "qadsia").awayWins + headToHeadSummary(meetings, "qadsia").draws).toBe(80);
  });
});
