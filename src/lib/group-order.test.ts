import { describe, expect, it } from "vitest";
import { isKnockoutRound } from "./group-order";

describe("knockout group labels", () => {
  it("does not attach groups to semi-finals", () => {
    expect(isKnockoutRound("Semi-finals")).toBe(true);
  });
  it("does not attach groups to the final", () => {
    expect(isKnockoutRound("Final")).toBe(true);
  });
  it("preserves groups for league rounds", () => {
    expect(isKnockoutRound("Round 1")).toBe(false);
  });
});