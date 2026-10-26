import { expect, it } from "vitest";
import { possibleLineupWindow } from "./possible-lineup";
it("shows possible lineups exactly seven days before kickoff, not earlier", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  expect(possibleLineupWindow("scheduled", "2026-10-31T12:00:00Z", null, now)).toBe(true);
  expect(possibleLineupWindow("scheduled", "2026-10-31T12:00:01Z", null, now)).toBe(false);
  expect(possibleLineupWindow("ft", "2026-10-25T12:00:00Z", null, now)).toBe(false);
});