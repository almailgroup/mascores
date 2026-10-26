import { describe, expect, it } from "vitest";
import { DEFAULT_MATCH_VIEW, matchDateKey, matchDates, upcomingStart } from "./match-calendar";

describe("match calendar", () => {
  it("marks announced round 11 dates even when kickoff times are unknown", () => {
    expect([...matchDates([{ kickoff_at: null, kickoff_date: "2026-12-14" }])]).toEqual(["2026-12-14"]);
  });
  it("defaults to upcoming matches", () => {
    expect(DEFAULT_MATCH_VIEW).toBe("upcoming");
  });
  it("marks only dates with matches, including finished matches", () => {
    const date = new Date(2026, 9, 23, 17);
    const dates = matchDates([{ kickoff_at: date.toISOString() }, { kickoff_at: null }]);
    expect(dates.has("2026-10-23")).toBe(true);
    expect(dates.has("2026-10-24")).toBe(false);
  });
  it("shows upcoming matches from now when Today is selected", () => {
    const now = new Date(2026, 9, 22, 13, 45);
    expect(upcomingStart(new Date(2026, 9, 22), now)).toBe(now.toISOString());
  });
  it("starts at midnight on a picked future date", () => {
    const selected = new Date(2026, 9, 25, 17);
    expect(upcomingStart(selected, new Date(2026, 9, 22, 13, 45))).toBe(new Date(2026, 9, 25).toISOString());
    expect(matchDateKey(selected)).toBe("2026-10-25");
  });
});