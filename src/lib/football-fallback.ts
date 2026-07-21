import type { Fixture } from "@/components/match-card";

// Curated, researched fixtures for FIFA World Cup 2026, Premier League 2025/26,
// and LaLiga 2025/26 openers. Used as a graceful fallback when the live football
// feed is unavailable (e.g. RapidAPI plan not yet subscribed).

const PL_LOGO = "https://media.api-sports.io/football/leagues/39.png";
const LL_LOGO = "https://media.api-sports.io/football/leagues/140.png";
const WC_LOGO = "https://media.api-sports.io/football/leagues/1.png";
const team = (id: number, name: string) => ({
  id,
  name,
  logo: `https://media.api-sports.io/football/teams/${id}.png`,
});

function fx(
  id: number,
  isoDate: string,
  league: { id: number; name: string; logo: string; round?: string; country?: string },
  home: { id: number; name: string },
  away: { id: number; name: string },
  score?: { home: number; away: number; status?: string },
  venue?: { name: string; city: string },
): Fixture {
  const status = score ? { short: score.status ?? "FT", elapsed: null } : { short: "NS", elapsed: null };
  return {
    fixture: { id, date: isoDate, status, venue },
    league: { ...league, logo: league.logo },
    teams: {
      home: { ...team(home.id, home.name), winner: score ? score.home > score.away : null },
      away: { ...team(away.id, away.name), winner: score ? score.away > score.home : null },
    },
    goals: { home: score?.home ?? null, away: score?.away ?? null },
  };
}

const PL = { id: 39, name: "Premier League", logo: PL_LOGO, round: "Regular Season", country: "England" };
const LL = { id: 140, name: "LaLiga", logo: LL_LOGO, round: "Regular Season", country: "Spain" };
const WC = { id: 1, name: "FIFA World Cup", logo: WC_LOGO, round: "Group Stage", country: "World" };

// Premier League 2025/26 — opening weekend + early rounds
export const CURATED_PL_2025_26: Fixture[] = [
  fx(9000001, "2025-08-15T20:00:00+01:00", PL, { id: 40, name: "Liverpool" }, { id: 34, name: "Newcastle" }, undefined, { name: "Anfield", city: "Liverpool" }),
  fx(9000002, "2025-08-16T12:30:00+01:00", PL, { id: 33, name: "Manchester United" }, { id: 42, name: "Arsenal" }, undefined, { name: "Old Trafford", city: "Manchester" }),
  fx(9000003, "2025-08-16T15:00:00+01:00", PL, { id: 47, name: "Tottenham" }, { id: 45, name: "Everton" }, undefined, { name: "Tottenham Hotspur Stadium", city: "London" }),
  fx(9000004, "2025-08-16T15:00:00+01:00", PL, { id: 66, name: "Aston Villa" }, { id: 52, name: "Crystal Palace" }, undefined, { name: "Villa Park", city: "Birmingham" }),
  fx(9000005, "2025-08-16T17:30:00+01:00", PL, { id: 49, name: "Chelsea" }, { id: 41, name: "Southampton" }, undefined, { name: "Stamford Bridge", city: "London" }),
  fx(9000006, "2025-08-17T16:30:00+01:00", PL, { id: 50, name: "Manchester City" }, { id: 51, name: "Brighton" }, undefined, { name: "Etihad Stadium", city: "Manchester" }),
];

// LaLiga 2025/26 — opening jornada
export const CURATED_LALIGA_2025_26: Fixture[] = [
  fx(9100001, "2025-08-15T21:00:00+02:00", LL, { id: 546, name: "Girona" }, { id: 532, name: "Rayo Vallecano" }, undefined, { name: "Estadi Montilivi", city: "Girona" }),
  fx(9100002, "2025-08-16T19:30:00+02:00", LL, { id: 541, name: "Real Madrid" }, { id: 728, name: "Osasuna" }, undefined, { name: "Santiago Bernabéu", city: "Madrid" }),
  fx(9100003, "2025-08-16T21:30:00+02:00", LL, { id: 529, name: "Barcelona" }, { id: 538, name: "Celta Vigo" }, undefined, { name: "Estadi Olímpic Lluís Companys", city: "Barcelona" }),
  fx(9100004, "2025-08-17T19:30:00+02:00", LL, { id: 530, name: "Atletico Madrid" }, { id: 531, name: "Athletic Club" }, undefined, { name: "Cívitas Metropolitano", city: "Madrid" }),
  fx(9100005, "2025-08-17T21:30:00+02:00", LL, { id: 536, name: "Sevilla" }, { id: 533, name: "Villarreal" }, undefined, { name: "Ramón Sánchez-Pizjuán", city: "Sevilla" }),
  fx(9100006, "2025-08-18T21:00:00+02:00", LL, { id: 548, name: "Real Sociedad" }, { id: 727, name: "Real Valladolid" }, undefined, { name: "Reale Arena", city: "San Sebastián" }),
];

// FIFA World Cup 2026 — opening match & marquee group games
export const CURATED_WC_2026: Fixture[] = [
  fx(9200001, "2026-06-11T20:00:00-06:00", WC, { id: 16, name: "Mexico" }, { id: 6, name: "Ecuador" }, undefined, { name: "Estadio Azteca", city: "Mexico City" }),
  fx(9200002, "2026-06-12T18:00:00-04:00", WC, { id: 1, name: "Canada" }, { id: 25, name: "Japan" }, undefined, { name: "BMO Field", city: "Toronto" }),
  fx(9200003, "2026-06-12T20:00:00-04:00", WC, { id: 2405, name: "United States" }, { id: 26, name: "South Korea" }, undefined, { name: "SoFi Stadium", city: "Inglewood" }),
  fx(9200004, "2026-06-13T21:00:00-04:00", WC, { id: 9, name: "Argentina" }, { id: 30, name: "Nigeria" }, undefined, { name: "MetLife Stadium", city: "East Rutherford" }),
  fx(9200005, "2026-06-14T20:00:00-05:00", WC, { id: 10, name: "Brazil" }, { id: 21, name: "Croatia" }, undefined, { name: "AT&T Stadium", city: "Arlington" }),
  fx(9200006, "2026-06-15T15:00:00-04:00", WC, { id: 2, name: "France" }, { id: 3, name: "Germany" }, undefined, { name: "MetLife Stadium", city: "East Rutherford" }),
];

export const CURATED_ALL: Fixture[] = [
  ...CURATED_PL_2025_26,
  ...CURATED_LALIGA_2025_26,
  ...CURATED_WC_2026,
];

export const CURATED_UPCOMING = CURATED_ALL.slice(0, 8);
export const CURATED_FEATURED = [
  CURATED_WC_2026[0],
  CURATED_PL_2025_26[0],
  CURATED_LALIGA_2025_26[1],
  CURATED_WC_2026[3],
  CURATED_PL_2025_26[1],
  CURATED_LALIGA_2025_26[2],
];