import { describe, expect, it } from "vitest";
import { matchEventOrder, resultScorers } from "./match-event-order";

describe("ordered result sharing", () => {
  const events = [
    { id: "home-first", type: "goal" },
    { id: "red", type: "red" },
    { id: "away-second", type: "penalty_goal" },
    { id: "home-third", type: "own_goal" },
  ];
  it("counts first, second and third goals across teams without counting cards as goals", () => {
    const order = matchEventOrder(events);
    expect([...order.entries()]).toEqual([["home-first", 1], ["red", 1], ["away-second", 2], ["home-third", 3]]);
  });
  it("replaces saved goal minutes with their event order for result sharing", () => {
    expect(resultScorers([
      { name: "Home scorer", minute: "12′", type: "goal", order: 1 },
      { name: "Away scorer", minute: "45+2′", type: "penalty_goal", order: 2 },
      { name: "Home scorer", minute: "80′ (OG)", type: "own_goal", order: 3 },
    ], true, false).map(s => s.minute)).toEqual(["1st goal", "2nd goal (P)", "3rd goal (OG)"]);
  });
  it("retains the saved minutes when event-order mode is off", () => {
    expect(resultScorers([{ name: "Scorer", minute: "45+2′", type: "goal", order: 1 }], false, false)[0]?.minute).toBe("45+2′");
  });
  it("keeps the same order for Arabic exports", () => {
    expect(resultScorers([{ name: "لاعب", minute: "12′", type: "goal", order: 2 }], true, true)[0]?.minute).toBe("الهدف ٢");
  });
});