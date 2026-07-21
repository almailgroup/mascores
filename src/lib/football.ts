import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { callFootball, type FootballEndpoint } from "./football.functions";

export const LEAGUES = {
  PREMIER_LEAGUE: 39,
  LALIGA: 140,
  WORLD_CUP: 1,
} as const;

export const CLUB_SEASON = 2025;
export const WC_SEASON = 2026;

export const FEATURED_LEAGUES = [
  { id: LEAGUES.WORLD_CUP, name: "FIFA World Cup 2026", season: WC_SEASON, slug: "world-cup-2026" },
  { id: LEAGUES.PREMIER_LEAGUE, name: "Premier League", season: CLUB_SEASON, slug: "premier-league" },
  { id: LEAGUES.LALIGA, name: "LaLiga", season: CLUB_SEASON, slug: "laliga" },
];

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type FootballResponse = { response: JsonValue[]; errors?: JsonValue };

export function useFootball<T = FootballResponse>(
  endpoint: FootballEndpoint,
  params?: Record<string, string | number | boolean | undefined>,
  opts?: Omit<UseQueryOptions<FootballResponse, Error, T>, "queryKey" | "queryFn">,
) {
  return useQuery<FootballResponse, Error, T>({
    queryKey: ["football", endpoint, params ?? {}],
    queryFn: () => callFootball({ data: { endpoint, params } }),
    staleTime: 30_000,
    ...opts,
  });
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function fixtureStatusLabel(short: string, elapsed: number | null): string {
  const live = ["1H", "2H", "ET", "P", "LIVE"].includes(short);
  if (live) return `${elapsed ?? ""}'`;
  if (short === "HT") return "HT";
  if (short === "FT" || short === "AET" || short === "PEN") return "FT";
  if (short === "NS") return "Not started";
  if (short === "PST") return "Postponed";
  if (short === "CANC") return "Cancelled";
  return short;
}

export const isLive = (short: string) => ["1H", "2H", "ET", "P", "LIVE", "HT"].includes(short);