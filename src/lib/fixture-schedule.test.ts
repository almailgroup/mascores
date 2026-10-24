import { describe, expect, it } from "vitest";
import { formatAnnouncedDate, scheduleTime } from "./fixture-schedule";

describe("announced Zain fixture dates", () => {
  it("retains the November 22 date without inventing a kickoff time", () => {
    const fixture = { kickoff_at: null, kickoff_date: "2026-11-22" };
    expect(scheduleTime(fixture)).toBe(new Date("2026-11-22T12:00:00").getTime());
    expect(formatAnnouncedDate(fixture.kickoff_date, "en-GB")).toContain("Time TBD");
    expect(formatAnnouncedDate(fixture.kickoff_date, "en-GB")).not.toContain("12:00");
  });
  it("puts an undated postponed fixture after dated fixtures within its round", () => {
    expect(scheduleTime({ kickoff_at: null, kickoff_date: null })).toBe(Infinity);
  });
});