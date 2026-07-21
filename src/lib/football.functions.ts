import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api-football-v1.p.rapidapi.com/v3";

export type FootballEndpoint =
  | "fixtures"
  | "fixtures/lineups"
  | "fixtures/statistics"
  | "fixtures/events"
  | "leagues"
  | "teams"
  | "teams/statistics"
  | "players"
  | "players/squads"
  | "coachs"
  | "trophies"
  | "transfers"
  | "venues"
  | "countries"
  | "standings";

type Params = Record<string, string | number | boolean | undefined>;

type FootballResponse = { response: Record<string, unknown>[]; errors?: Record<string, unknown> | unknown[] };

// Cheap in-memory cache to soften repeat calls during a single worker lifetime.
const cache = new Map<string, { at: number; data: FootballResponse }>();
const TTL = 60_000;

export const callFootball = createServerFn({ method: "POST" })
  .inputValidator((data: { endpoint: FootballEndpoint; params?: Params }) => data)
  .handler(async ({ data }) => {
    const key = process.env.RAPIDAPI_FOOTBALL_KEY;
    if (!key) throw new Error("Football API key is not configured");
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(data.params ?? {})) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    const url = `${BASE}/${data.endpoint}${qs.size ? "?" + qs.toString() : ""}`;
    const cached = cache.get(url);
    if (cached && Date.now() - cached.at < TTL) return cached.data;

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Football API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as FootballResponse;
    cache.set(url, { at: Date.now(), data: json });
    return json;
  });