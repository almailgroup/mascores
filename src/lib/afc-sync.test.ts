import { describe, expect, it } from "vitest";
import { bestPlayer, bestTeam, mapEventType, mapStatus } from "./afc-sync";

const teams = ["Kuwait SC", "Al Khaldiya FC", "Al Wahda FC", "Viettel FC", "Pathum United FC", "Lion City FC"].map((name, i) => ({ id: String(i), name }));

describe("AFC sync matching", () => {
  it("matches feed club names to existing clubs", () => {
    expect(bestTeam("Al Kuwait SC", teams)?.name).toBe("Kuwait SC");
    expect(bestTeam("Al Khalidiyah", teams)?.name).toBe("Al Khaldiya FC");
    expect(bestTeam("Thể Công - Viettel", teams)?.name).toBe("Viettel FC");
    expect(bestTeam("BG Pathum United", teams)?.name).toBe("Pathum United FC");
    expect(bestTeam("Melbourne Victory", teams)).toBeNull();
  });
  it("never matches an unknown player to someone else", () => {
    const squad = [{ id: "a", name: "Yousef Nasser", shirt_number: 20 }, { id: "b", name: "Fahad Al Hajeri", shirt_number: 5 }];
    expect(bestPlayer("Y. Nasser", squad)?.id).toBe("a");
    expect(bestPlayer("Mohammed Daham", squad)).toBeNull();
  });
  it("maps statuses and events", () => {
    expect(mapStatus("HT")).toBe("ht");
    expect(mapStatus("PEN")).toBe("pen");
    expect(mapEventType("Goal", "Penalty")).toBe("penalty_goal");
    expect(mapEventType("Card", "Red Card")).toBe("red");
  });
});
