import { describe, expect, it } from "vitest";
import { groupUpcomingCountries } from "./upcoming-countries";

const now = Date.parse("2026-10-22T10:30:00Z");
const fixture = { status: "scheduled", kickoff_at: "2026-10-23T15:00:00Z", competition: { name: "League", country: "Kuwait", country_code: "KW" } };
describe("upcoming country matches", () => {
  it("shows only countries with future scheduled matches", () => {
    const groups = groupUpcomingCountries([fixture, { ...fixture, status: "ft", competition: { ...fixture.competition, country: "England" } }, { ...fixture, kickoff_at: "2026-10-21T15:00:00Z" }], now);
    expect(groups.map((group) => group.name)).toEqual(["Kuwait"]);
    expect(groups[0]?.matches).toHaveLength(1);
  });
  it("places club friendlies under World", () => {
    expect(groupUpcomingCountries([{ ...fixture, competition: { ...fixture.competition, name: "Club Friendlies" } }], now)[0]?.name).toBe("World");
  });
});