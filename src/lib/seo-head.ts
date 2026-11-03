import { createServerFn } from "@tanstack/react-start";

export type SeoInfo = { title: string; description: string } | null;
type Kind = "team" | "player" | "competition" | "match";

const BASE = "https://mascores.live";

/** Public, read-only lookup of page names so search engines see real titles. */
export const getSeoInfo = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: Kind; id: string }) => {
    if (!["team", "player", "competition", "match"].includes(d?.kind) || typeof d.id !== "string" || d.id.length > 200) throw new Error("bad input");
    return d;
  })
  .handler(async ({ data }): Promise<SeoInfo> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
      const sb = createClient(process.env["SUPABASE_URL"]!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === "Bearer " + key) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
      });
      const both = (n?: string | null, ar?: string | null) => (ar && ar !== n ? `${n} | ${ar}` : n ?? "");
      if (data.kind === "competition") {
        const { data: c } = await sb.from("competitions").select("name,name_ar").eq("slug", data.id).maybeSingle();
        if (!c) return null;
        return { title: `${both(c.name, c.name_ar)} — Live Scores, Fixtures & Table | MaScores`, description: `${c.name} live scores, fixtures, results, standings, lineups, player ratings and top scorers on MaScores.` };
      }
      if (data.kind === "team") {
        const { data: t } = await sb.from("teams").select("name,name_ar,country").eq("id", data.id).maybeSingle();
        if (!t) return null;
        return { title: `${both(t.name, t.name_ar)} — Fixtures, Results & Squad | MaScores`, description: `${t.name} fixtures, results, squad, lineups, transfers and news${t.country ? ` (${t.country})` : ""} on MaScores.` };
      }
      if (data.kind === "player") {
        const { data: p } = await sb.from("players").select("name,name_ar,position,team_id").eq("id", data.id).maybeSingle();
        if (!p) return null;
        const { data: t } = p.team_id ? await sb.from("teams").select("name").eq("id", p.team_id).maybeSingle() : { data: null };
        return { title: `${both(p.name, p.name_ar)} — Stats & Ratings | MaScores`, description: `${p.name}${p.position ? `, ${p.position}` : ""}${t?.name ? ` at ${t.name}` : ""}: matches, goals, assists, ratings and career on MaScores.` };
      }
      const { data: m } = await sb.from("matches").select("home_team_id,away_team_id,home_score,away_score,status,kickoff_at,kickoff_date,competition_id").eq("id", data.id).maybeSingle();
      if (!m) return null;
      const ids = [m.home_team_id, m.away_team_id].filter(Boolean) as string[];
      const [{ data: teams }, { data: comp }] = await Promise.all([
        sb.from("teams").select("id,name").in("id", ids),
        m.competition_id ? sb.from("competitions").select("name").eq("id", m.competition_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const name = (id: string | null) => teams?.find((x) => x.id === id)?.name ?? "TBD";
      const played = m.home_score != null && m.away_score != null && m.status !== "scheduled";
      const vs = played ? `${name(m.home_team_id)} ${m.home_score}–${m.away_score} ${name(m.away_team_id)}` : `${name(m.home_team_id)} vs ${name(m.away_team_id)}`;
      const date = (m.kickoff_at ?? m.kickoff_date ?? "").slice(0, 10);
      return { title: `${vs}${comp?.name ? ` — ${comp.name}` : ""} | MaScores`, description: `${vs}${date ? ` on ${date}` : ""}${comp?.name ? ` in the ${comp.name}` : ""}: live score, lineups, events, ratings and statistics on MaScores.` };
    } catch {
      return null;
    }
  });

export function seoHead(info: SeoInfo | undefined, fallbackTitle: string, path: string) {
  const title = info?.title ?? fallbackTitle;
  const description = info?.description ?? "Kuwaiti and international football live scores, lineups and stats on MaScores.";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BASE + path },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: BASE + path }],
  };
}
