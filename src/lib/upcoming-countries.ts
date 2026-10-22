type CountryFixture = {
  status: string;
  kickoff_at: string;
  competition: { name: string; country?: string | null; country_code?: string | null } | null;
};

export function groupUpcomingCountries<T extends CountryFixture>(matches: T[], now = Date.now()) {
  const groups = new Map<string, { name: string; code: string | null; matches: T[] }>();
  for (const match of matches) {
    if (match.status !== "scheduled" || new Date(match.kickoff_at).getTime() < now) continue;
    const friendly = /friendly|friendlies|ودية|وديه/i.test(match.competition?.name ?? "");
    const name = friendly ? "World" : match.competition?.country?.trim() || "World";
    const group = groups.get(name) ?? { name, code: name === "World" ? null : match.competition?.country_code ?? name, matches: [] };
    group.matches.push(match);
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) => a.name === "World" ? -1 : b.name === "World" ? 1 : a.name.localeCompare(b.name));
}