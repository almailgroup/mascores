import { describe, expect, it } from "vitest";
import { visibleWelcomeTeams } from "./welcome-teams";

const teams = [
  { id: "arabi", name: "Al Arabi SC", name_ar: "العربي" },
  { id: "qadsia", name: "Al Qadsia SC", name_ar: "القادسية" },
  { id: "kuwait", name: "Kuwait", is_national: true, country_code: "KW" },
  { id: "youth", name: "Kuwait U23", is_national: true, country_code: "KW", age_group: "U23" },
  { id: "madrid", name: "Real Madrid", name_ar: "ريال مدريد" },
  { id: "burgan", name: "Burgan SC" },
];
const leagueIds = ["arabi", "qadsia"];
const tx = (name: string) => name;

describe("Choose your teams", () => {
  it("shows only Zain Premier League members and Kuwait senior national team without search", () => {
    expect(visibleWelcomeTeams(teams, leagueIds, "", tx).map((team) => team.id)).toEqual(["arabi", "qadsia", "kuwait"]);
    expect(visibleWelcomeTeams(teams, leagueIds, "   ", tx).map((team) => team.id)).toEqual(["arabi", "qadsia", "kuwait"]);
  });
  it("finds other teams through English and Arabic search", () => {
    expect(visibleWelcomeTeams(teams, leagueIds, "Madrid", tx).map((team) => team.id)).toEqual(["madrid"]);
    expect(visibleWelcomeTeams(teams, leagueIds, "ريال", tx).map((team) => team.id)).toEqual(["madrid"]);
    expect(visibleWelcomeTeams(teams, leagueIds, "Burgan", tx).map((team) => team.id)).toEqual(["burgan"]);
  });
});
