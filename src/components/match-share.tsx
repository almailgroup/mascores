import { drawMatchLineupsCard, drawResultCard, drawTeamLineupCard } from "@/lib/share-cards";
import { ShareCardButton } from "@/components/share-image";
import { useI18n } from "@/lib/i18n";

export type ShareTeam = { name?: string | null; logo_url?: string | null };
export type ShareScorer = { name: string; minute: string };
export type ShareLineupPlayer = { number: string; name: string; photo?: string | null };

/** One club's starting eleven laid out by formation row, plus coach and bench. */
export type ShareLineup = {
  teamName: string;
  logo?: string | null;
  formation: string;
  coach?: string | null;
  rows: ShareLineupPlayer[][];
  bench: ShareLineupPlayer[];
};

export type MatchShareData = {
  competition: string;
  kickoff: string;
  status: string;
  home: ShareTeam;
  away: ShareTeam;
  homeScore: string;
  awayScore: string;
  homeScorers: ShareScorer[];
  awayScorers: ShareScorer[];
  homeLineup: ShareLineupPlayer[];
  awayLineup: ShareLineupPlayer[];
  lineup?: ShareLineup | null;
  lineups?: ShareLineup[];
  accent: string;
  accentAway?: string;
};

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = window.setTimeout(() => { img.src = ""; resolve(null); }, 8000);
    img.onload = () => { window.clearTimeout(timeout); resolve(img); };
    img.onerror = () => { window.clearTimeout(timeout); resolve(null); };
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Canvas cannot parse color-mix()/oklab, so anything unusual falls back. */
function safeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return /^(#|rgb|hsl)/i.test(value.trim()) ? value : fallback;
}


/** Draws the branded share card: match result, or one club's line-up on a pitch. */
async function drawCard(data: MatchShareData, mode: "result" | "lineups"): Promise<Blob | null> {
  if (mode === "lineups" && data.lineup) return drawTeamLineupCard({ competition: data.competition, kickoff: data.kickoff, team: data.lineup, accent: safeColor(data.accent, "#1d4ed8") });
  if (mode === "result") return drawResultCard({ competition: data.competition, kickoff: data.kickoff, status: data.status, accent: safeColor(data.accent, "#16224a"), accentAway: safeColor(data.accentAway, safeColor(data.accent, "#16224a")), home: { name: data.home.name ?? "TBD", logo: data.home.logo_url }, away: { name: data.away.name ?? "TBD", logo: data.away.logo_url }, homeScore: String(data.homeScore), awayScore: String(data.awayScore), homeScorers: data.homeScorers, awayScorers: data.awayScorers });
  if (mode === "lineups") return drawMatchLineupsCard({ competition: data.competition, kickoff: data.kickoff, teams: data.lineups ?? (data.lineup ? [data.lineup] : []), accent: safeColor(data.accent, "#1d4ed8") });
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const accent = safeColor(data.accent, "#16224a");
  const accentAway = safeColor(data.accentAway, accent);


  const H2 = H;
  // Two solid halves that meet at a thin seam - the colours never blend together.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W / 2, H2);
  ctx.fillStyle = accentAway;
  ctx.fillRect(W / 2, 0, W / 2, H2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(W / 2 - 4, 0, 8, H2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, H2);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.competition.slice(0, 46), W / 2, 96);
  ctx.font = "400 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(data.kickoff, W / 2, 142);

  const [homeLogo, awayLogo] = await Promise.all([loadImage(data.home.logo_url), loadImage(data.away.logo_url)]);
  const crest = (img: HTMLImageElement | null, cx: number, cy: number, size: number, label?: string | null) => {
    ctx.save();
    if (!img) {
      // Monogram fallback still needs a plate; a real badge sits on the colour.
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 28);
      ctx.fill();
    }
    if (img) {
      const scale = Math.min((size - 24) / img.width, (size - 24) / img.height);
      ctx.drawImage(img, cx - (img.width * scale) / 2, cy - (img.height * scale) / 2, img.width * scale, img.height * scale);
    } else if (label) {
      ctx.fillStyle = accent;
      ctx.font = "800 64px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(label.slice(0, 2).toUpperCase(), cx, cy);
    }
    ctx.restore();
  };

  ctx.textBaseline = "alphabetic";
  crest(homeLogo, 220, 300, 180, data.home.name);
  crest(awayLogo, W - 220, 300, 180, data.away.name);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 92px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.homeScore === "" ? "VS" : `${data.homeScore} - ${data.awayScore}`, W / 2, 320);
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(data.status, W / 2, 368);

  ctx.font = "700 36px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText((data.home.name ?? "TBD").slice(0, 22), 220, 440);
  ctx.fillText((data.away.name ?? "TBD").slice(0, 22), W - 220, 440);

  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "right";
  data.homeScorers.slice(0, 8).forEach((scorer, index) => ctx.fillText(`${scorer.name} ${scorer.minute}`, W / 2 - 60, 540 + index * 46));
  ctx.textAlign = "left";
  data.awayScorers.slice(0, 8).forEach((scorer, index) => ctx.fillText(`${scorer.name} ${scorer.minute}`, W / 2 + 60, 540 + index * 46));


  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

/** Result and lineup cards share the same save-to-Photos experience. */
export function MatchShare({ data, mode }: { data: MatchShareData; mode: "result" | "lineups" }) {
  const { lang } = useI18n();
  const title = mode === "lineups"
    ? `${data.lineup?.teamName ?? data.home.name ?? ""} · ${lang === "ar" ? "التشكيلة" : "Lineup"}`
    : `${data.home.name ?? ""} ${data.homeScore === "" ? "vs" : `${data.homeScore}-${data.awayScore}`} ${data.away.name ?? ""}`.trim();
  return <ShareCardButton render={() => drawCard(data, mode)} title={title} iconOnly={mode === "result"}
    label={mode === "lineups" ? (lang === "ar" ? "مشاركة التشكيلة" : "Share line-ups") : (lang === "ar" ? "مشاركة المباراة" : "Share match")} />;
}
