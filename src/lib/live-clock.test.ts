import { describe, it, expect } from "vitest";
import { formatLiveClock, livePeriod } from "./db";

describe("live clock stoppage time", () => {
  it("never advances an unassigned period at 45 minutes and one second", () => {
    expect(livePeriod({ period: null }, 2701)).toBe("1h");
    expect(formatLiveClock({ period: null }, 2701)).toBe("45+1'");
  });
  it("keeps the first half even through 90 minutes of added time", () => {
    expect(livePeriod({ period: "1h" }, 2700 + 89 * 60)).toBe("1h");
    expect(formatLiveClock({ period: "1h" }, 2700 + 89 * 60)).toBe("45+90'");
  });
  it("first half past 45 shows 45+X, not second half", () => {
    expect(livePeriod({ period: "1h" }, 2760)).toBe("1h");
    expect(formatLiveClock({ period: "1h" }, 2760)).toBe("45+2'");
  });
  it("second half past 90 shows 90+X, not extra time", () => {
    expect(formatLiveClock({ period: "2h" }, 5400 + 20 * 60)).toBe("90+21'");
  });
  it("normal running clock stays mm:ss", () => {
    expect(formatLiveClock({ period: "2h" }, 3000)).toBe("50:00");
  });
});
