import { createFileRoute } from "@tanstack/react-router";

type Fx = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null }; venue?: { name?: string; city?: string } };
  league: { name: string; round?: string; logo?: string; country?: string };
  teams: { home: { id: number; name: string; logo?: string }; away: { id: number; name: string; logo?: string } };
  goals: { home: number | null; away: number | null };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function fetchAsDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    // eslint-disable-next-line no-undef
    const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
    const mime = r.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${b64}`;
  } catch { return null; }
}

function statusLine(f: Fx): string {
  const s = f.fixture.status.short;
  if (["FT", "AET", "PEN"].includes(s)) return "Full Time";
  if (["1H", "2H", "ET", "LIVE"].includes(s)) return `LIVE · ${f.fixture.status.elapsed ?? 0}'`;
  if (s === "HT") return "Half Time";
  if (s === "NS") return new Date(f.fixture.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return s;
}

function renderSvg(f: Fx, homeLogo: string | null, awayLogo: string | null) {
  const started = !["NS", "PST", "CANC", "TBD"].includes(f.fixture.status.short);
  const score = started ? `${f.goals.home ?? 0} – ${f.goals.away ?? 0}` : "vs";
  const status = statusLine(f);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a1024"/>
      <stop offset="1" stop-color="#111a3d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="600" cy="315" r="380" fill="url(#glow)"/>
  <text x="60" y="80" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="24" font-weight="700" fill="#93c5fd" letter-spacing="4">MANSOURALMAILSCORES</text>
  <text x="60" y="118" font-family="system-ui, sans-serif" font-size="22" fill="#cbd5e1">${esc(f.league.name)}${f.league.round ? ` · ${esc(f.league.round)}` : ""}</text>

  <g transform="translate(180, 260)">
    ${homeLogo ? `<image href="${homeLogo}" x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>` : `<rect width="180" height="180" rx="18" fill="#1e293b"/>`}
    <text x="90" y="230" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="800" fill="#ffffff">${esc(f.teams.home.name)}</text>
  </g>

  <g transform="translate(840, 260)">
    ${awayLogo ? `<image href="${awayLogo}" x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>` : `<rect width="180" height="180" rx="18" fill="#1e293b"/>`}
    <text x="90" y="230" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="800" fill="#ffffff">${esc(f.teams.away.name)}</text>
  </g>

  <text x="600" y="380" text-anchor="middle" font-family="system-ui, sans-serif" font-size="120" font-weight="900" fill="#ffffff" letter-spacing="-2">${esc(score)}</text>
  <text x="600" y="440" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#60a5fa" letter-spacing="4">${esc(status.toUpperCase())}</text>

  ${f.fixture.venue?.name ? `<text x="600" y="580" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#94a3b8">${esc(f.fixture.venue.name)}${f.fixture.venue.city ? ` · ${esc(f.fixture.venue.city)}` : ""}</text>` : ""}
  <text x="1140" y="600" text-anchor="end" font-family="system-ui, sans-serif" font-size="18" fill="#64748b">LIVE SCORES · REAL PASSION</text>
</svg>`;
}

export const Route = createFileRoute("/api/public/share/match/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = process.env.RAPIDAPI_FOOTBALL_KEY;
        if (!key) return new Response("Missing key", { status: 500 });
        const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?id=${encodeURIComponent(params.id)}`;
        const r = await fetch(url, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "api-football-v1.p.rapidapi.com" } });
        if (!r.ok) return new Response("Upstream error", { status: 502 });
        const j = (await r.json()) as { response: Fx[] };
        const f = j.response?.[0];
        if (!f) return new Response("Match not found", { status: 404 });

        const [homeLogo, awayLogo] = await Promise.all([
          fetchAsDataUrl(f.teams.home.logo),
          fetchAsDataUrl(f.teams.away.logo),
        ]);
        const svg = renderSvg(f, homeLogo, awayLogo);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=60",
          },
        });
      },
    },
  },
});