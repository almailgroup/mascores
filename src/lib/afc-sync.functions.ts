import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bestPlayer, bestTeam, mapEventType, mapStatus } from "./afc-sync";

const AFC_CL2_LEAGUE = 18;
const API = "https://v3.football.api-sports.io";

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  score: { penalty: { home: number | null; away: number | null } };
};
type ApiEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
};

export type SyncChange = {
  matchId: string;
  label: string;
  changes: string[];
  newEvents: number;
  unmatchedPlayers: string[];
};

async function api<T>(path: string, key: string): Promise<{ data: T[]; remaining: number | null }> {
  const res = await fetch(`${API}${path}`, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error("The football data service did not respond. Try again shortly.");
  const json = (await res.json()) as { response: T[]; errors: unknown };
  const errs = json.errors && typeof json.errors === "object" ? Object.values(json.errors as Record<string, string>) : [];
  if (errs.length) throw new Error(String(errs[0]));
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  return { data: json.response ?? [], remaining: rem ? Number(rem) : null };
}

export const syncAfcChampionsLeagueTwo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ competitionId: z.string().uuid(), apply: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) throw new Error("Only admins can sync matches.");
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error("The football data key is not set up.");
    const db = context.supabase;

    const { data: matches, error } = await db
      .from("matches")
      .select("id, home_team_id, away_team_id, status, home_score, away_score, home_pen, away_pen, live_minute, kickoff_at, season")
      .eq("competition_id", data.competitionId);
    if (error) throw new Error("Could not read matches.");
    const teamIds = [...new Set((matches ?? []).flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean) as string[])];
    const { data: teams } = teamIds.length ? await db.from("teams").select("id, name").in("id", teamIds) : { data: [] };
    const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

    const season = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
    const fixtures = await api<ApiFixture>(`/fixtures?league=${AFC_CL2_LEAGUE}&season=${season}`, key);
    let remaining = fixtures.remaining;

    const results: SyncChange[] = [];
    const unmatchedFixtures: string[] = [];
    const now = Date.now();

    for (const fx of fixtures.data) {
      const home = bestTeam(fx.teams.home.name, teams ?? []);
      const away = bestTeam(fx.teams.away.name, teams ?? []);
      const match = home && away
        ? (matches ?? []).find((m) =>
            (m.home_team_id === home.id && m.away_team_id === away.id) || (m.home_team_id === away.id && m.away_team_id === home.id))
        : undefined;
      if (!match) {
        if (Math.abs(new Date(fx.fixture.date).getTime() - now) < 30 * 86400000) unmatchedFixtures.push(`${fx.teams.home.name} v ${fx.teams.away.name}`);
        continue;
      }
      const swapped = match.home_team_id !== home!.id;
      const hs = swapped ? fx.goals.away : fx.goals.home;
      const as = swapped ? fx.goals.home : fx.goals.away;
      const hp = swapped ? fx.score.penalty.away : fx.score.penalty.home;
      const ap = swapped ? fx.score.penalty.home : fx.score.penalty.away;
      const status = mapStatus(fx.fixture.status.short);
      const label = `${teamName.get(match.home_team_id!) ?? "?"} v ${teamName.get(match.away_team_id!) ?? "?"}`;

      const patch: Record<string, unknown> = {};
      const changes: string[] = [];
      if (status !== match.status && !(status === "scheduled" && match.status === "postponed")) { patch.status = status; changes.push(`Status → ${status.toUpperCase()}`); }
      if (hs != null && as != null && (hs !== match.home_score || as !== match.away_score)) {
        patch.home_score = hs; patch.away_score = as; changes.push(`Score → ${hs}-${as}`);
      }
      if (hp != null && ap != null && (hp !== match.home_pen || ap !== match.away_pen)) { patch.home_pen = hp; patch.away_pen = ap; changes.push(`Penalties → ${hp}-${ap}`); }
      const live = status === "live" || status === "ht";
      if (live && fx.fixture.status.elapsed != null && fx.fixture.status.elapsed !== match.live_minute) { patch.live_minute = fx.fixture.status.elapsed; changes.push(`Minute → ${fx.fixture.status.elapsed}'`); }
      if (fx.fixture.date && status === "scheduled") {
        const apiTime = new Date(fx.fixture.date).getTime();
        if (!match.kickoff_at || Math.abs(new Date(match.kickoff_at).getTime() - apiTime) > 60000) {
          patch.kickoff_at = new Date(apiTime).toISOString(); changes.push("Kickoff time updated");
        }
      }

      // Events: only for live games or finished games we have no events for yet (saves daily requests).
      let newEvents = 0;
      const unmatchedPlayers: string[] = [];
      const finished = ["ft", "aet", "pen"].includes(status);
      const { data: existing } = await db.from("match_events").select("type, minute, player_id, team_id").eq("match_id", match.id);
      const needEvents = live || (finished && (existing ?? []).length === 0);
      const inserts: Record<string, unknown>[] = [];
      if (needEvents && (remaining == null || remaining > 3)) {
        const ev = await api<ApiEvent>(`/fixtures/events?fixture=${fx.fixture.id}`, key);
        remaining = ev.remaining;
        const squads = new Map<string, { id: string; name: string; short_name: string | null; shirt_number: number | null }[]>();
        for (const tid of [match.home_team_id!, match.away_team_id!]) {
          const { data: ps } = await db.from("players").select("id, name, short_name, shirt_number").eq("team_id", tid);
          squads.set(tid, ps ?? []);
        }
        for (const e of ev.data) {
          const type = mapEventType(e.type, e.detail);
          if (!type) continue;
          const teamId = e.team.id === fx.teams.home.id ? home!.id : away!.id;
          const squad = squads.get(teamId) ?? [];
          // The feed lists the player going off as "player" and the one coming on as "assist" for substitutions.
          const primaryName = type === "substitution" ? e.assist.name : e.player.name;
          const secondName = type === "substitution" ? e.player.name : e.assist.name;
          const primary = bestPlayer(primaryName, squad);
          const second = bestPlayer(secondName, squad);
          if (primaryName && !primary) unmatchedPlayers.push(`${primaryName} (${teamName.get(teamId)})`);
          if (secondName && !second) unmatchedPlayers.push(`${secondName} (${teamName.get(teamId)})`);
          const dup = (existing ?? []).some((x) => x.type === type && x.minute === e.time.elapsed && x.team_id === teamId && (!primary || x.player_id === primary.id));
          if (dup) continue;
          inserts.push({
            match_id: match.id,
            minute: e.time.elapsed,
            extra: e.time.extra,
            team_id: teamId,
            type,
            player_id: primary?.id ?? null,
            assist_player_id: type === "substitution" ? null : second?.id ?? null,
            sub_out_player_id: type === "substitution" ? second?.id ?? null : null,
            description: primary ? null : primaryName,
          });
        }
        newEvents = inserts.length;
      }

      if (!changes.length && !newEvents) continue;
      results.push({ matchId: match.id, label, changes, newEvents, unmatchedPlayers: [...new Set(unmatchedPlayers)] });

      if (data.apply) {
        if (Object.keys(patch).length) {
          if (finished && !match.status.match(/ft|aet|pen/)) patch.completed_at = new Date().toISOString();
          const { error: upErr } = await db.from("matches").update(patch).eq("id", match.id);
          if (upErr) throw new Error(`Could not update ${label}.`);
        }
        if (inserts.length) {
          const { error: evErr } = await db.from("match_events").insert(inserts as never);
          if (evErr) throw new Error(`Could not save events for ${label}.`);
        }
      }
    }

    return { applied: data.apply, results, unmatchedFixtures: unmatchedFixtures.slice(0, 20), remaining };
  });
