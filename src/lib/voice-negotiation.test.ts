import { describe, expect, it } from "vitest";
import { ignoreCollidingOffer } from "./voice-negotiation";
describe("simultaneous voice speakers", () => {
  it("gives each collision to exactly one side, including all three speaker pairs", () => {
    for (const [a, b] of [["a", "b"], ["a", "c"], ["b", "c"]]) {
      expect(ignoreCollidingOffer(a, b, true, "have-local-offer", false)).toBe(true);
      expect(ignoreCollidingOffer(b, a, true, "have-local-offer", false)).toBe(false);
    }
  });
  it("accepts stable incoming offers", () => {
    expect(ignoreCollidingOffer("a", "b", false, "stable", false)).toBe(false);
  });
});