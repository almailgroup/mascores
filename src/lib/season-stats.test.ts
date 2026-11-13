import { describe, expect, it } from "vitest";
import { fixtureSeasons, seasonFixtures } from "./season-stats";

describe("club season statistics", () => {
  it("2026/2027 excludes historical matches from 2025/2026", () => {
    const fixtures = [{ id: "new", season: "2026/2027" }, { id: "old", season: "2025/2026" }];
    expect(seasonFixtures(fixtures, "2026/2027").map(m => m.id)).toEqual(["new"]);
  });
  it("2025/2026 selects its own matches including short season labels", () => {
    expect(seasonFixtures([{ season: "25/26" }, { season: "2026/2027" }], "2025/2026")).toEqual([{ season: "25/26" }]);
  });
  it("defaults to newest available season, not the last historical row", () => {
    expect(fixtureSeasons([{ season: "2001/2002" }, { season: "2025/2026" }, { season: "2026/2027" }])[0]).toBe("2026/2027");
  });
});