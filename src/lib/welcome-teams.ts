import { normSearch } from "./norm-search";

type WelcomeTeam = {
  id: string; name: string; name_ar?: string | null; short_name?: string | null;
  country?: string | null; country_code?: string | null; is_national?: boolean | null;
  parent_team_id?: string | null; age_group?: string | null;
};

/** Empty search browses league members; searching spans the complete catalogue. */
export function visibleWelcomeTeams<T extends WelcomeTeam>(teams: T[], leagueTeamIds: string[], query: string, translate: (name: string) => string): T[] {
  const needle = normSearch(query);
  const league = new Set(leagueTeamIds);
  return teams.filter((team) => {
    if (!needle) {
      const kuwait = team.is_national === true && team.country_code?.toUpperCase() === "KW" && !team.parent_team_id && !team.age_group;
      return league.has(team.id) || kuwait;
    }
    return normSearch(`${team.name} ${team.short_name ?? ""} ${team.name_ar ?? ""} ${translate(team.name)} ${team.country ?? ""}`).includes(needle)
      || normSearch(`${team.name_ar ?? ""} ${translate(team.name)}`).includes(needle.replace(/^ال/, ""));
  });
}
