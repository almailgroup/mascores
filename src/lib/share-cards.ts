import goalIcon from "@/assets/events/goal-white.png";
import logoMarkWhite from "@/assets/logo-mark-dark.png";
const logoMark = { url: logoMarkWhite };
import { portraitSource } from "@/lib/portrait-source";

/**
 * Designed share pictures drawn on a canvas - never a screenshot of the page.
 * Everything is laid out for a 1080px wide square-ish card that looks right in
 * a chat app or on a story.
 */

const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

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

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  // A dedicated footer keeps every export branded without covering photos or names.
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height + 196;
  const ctx = output.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, canvas.height, output.width, 196);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(60, canvas.height + 10, output.width - 120, 1);
  const mark = await loadImage(logoMark.url);
  if (mark) crest(ctx, mark, "", output.width - 140, canvas.height + 95, 160);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText("MaScores", 60, canvas.height + 65);
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText("mascores.live", 60, canvas.height + 108);
  ctx.fillText("Instagram · @mascoreslive", 60, canvas.height + 148);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Powered by Mansour Almail", 60, canvas.height + 172);
  return new Promise((resolve) => output.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

function surface(width: number, height: number, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createLinearGradient(0, 0, width, 360);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, "rgba(11,16,32,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 360);
  return { canvas, ctx };
}


function crest(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, cx: number, cy: number, size: number) {
  if (img) {
    const scale = Math.min(size / img.width, size / img.height);
    ctx.drawImage(img, cx - (img.width * scale) / 2, cy - (img.height * scale) / 2, img.width * scale, img.height * scale);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(size * 0.4)}px ${FONT}`;
  ctx.fillText((name || "?").slice(0, 2).toUpperCase(), cx, cy + 1);
  ctx.restore();
  ctx.textBaseline = "alphabetic";
}

export type StandingsCardRow = {
  position: number;
  name: string;
  logo?: string | null;
  played: number;
  won?: number; drawn?: number; lost?: number; gf?: number; ga?: number;
  goalDifference: number;
  points: number;
  form?: ("W" | "D" | "L")[];
  highlight?: boolean;
};

export type StandingsCardGroup = { label?: string | null; rows: StandingsCardRow[] };

/** Standings table redrawn as a branded picture. */
export async function drawStandingsCard(input: {
  title: string;
  subtitle?: string | null;
  accent?: string | null;
  groups: StandingsCardGroup[];
  withForm?: boolean;
  withFull?: boolean;
}): Promise<Blob | null> {
  const W = 1080;
  const rowH = 68;
  const groups = input.groups.map((g) => ({ ...g, rows: g.rows }));
  const body = groups.reduce((total, g) => total + (g.label ? 58 : 0) + 54 + g.rows.length * rowH + 28, 0);
  const H = Math.max(760, 250 + body + 90);
  const made = surface(W, H, input.accent || "#1d4ed8");
  if (!made) return null;
  const { canvas, ctx } = made;

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText(input.title.slice(0, 28), 60, 130);
  if (input.subtitle) {
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(input.subtitle.slice(0, 44), 60, 180);
  }

  const logos = await Promise.all(groups.flatMap((g) => g.rows).map((r) => loadImage(r.logo)));
  let logoIndex = 0;
  let y = 250;

  for (const group of groups) {
    if (group.label) {
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(group.label.slice(0, 30), 60, y + 34);
      y += 58;
    }
    // Column headings
    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("#", 66, y + 34);
    ctx.fillText("TEAM", 130, y + 34);
    ctx.textAlign = "center";
    if (input.withForm) {
      ctx.fillText("LAST 5", W - 190, y + 34);
    } else if (input.withFull) {
      ["P","W","D","L","GLS","GD","PTS"].forEach((label,i)=>ctx.fillText(label,580+i*65,y+34));
    } else {
      ctx.fillText("P", W - 300, y + 34);
      ctx.fillText("GD", W - 200, y + 34);
      ctx.fillText("PTS", W - 100, y + 34);
    }
    y += 54;

    group.rows.forEach((row, index) => {
      const top = y + index * rowH;
      ctx.fillStyle = row.highlight ? "rgba(255,255,255,0.16)" : index % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)";
      roundRect(ctx, 50, top, W - 100, rowH - 10, 18);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.font = `800 26px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(String(row.position), 82, top + 39);

      crest(ctx, logos[logoIndex] ?? null, row.name, 140, top + 29, 40);
      logoIndex += 1;

      ctx.textAlign = "left";
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(row.name, 175, top + 39, input.withFull ? 350 : 480);

      if (input.withForm) {
        const results = (row.form ?? []).slice(-5);
        const boxW = 44;
        results.forEach((result, k) => {
          const x = W - 80 - (results.length - k) * (boxW + 6);
          ctx.fillStyle = result === "W" ? "#16a34a" : result === "L" ? "#dc2626" : "rgba(255,255,255,0.35)";
          roundRect(ctx, x, top + 10, boxW, 38, 10);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.font = `800 24px ${FONT}`;
          ctx.fillText(result, x + boxW / 2, top + 37);
        });
      } else if (input.withFull) {
        ctx.textAlign="center";ctx.font=`600 24px ${FONT}`;ctx.fillStyle="#ffffff";
        [row.played,row.won??0,row.drawn??0,row.lost??0,`${row.gf??0}:${row.ga??0}`,row.goalDifference,row.points].forEach((value,i)=>ctx.fillText(String(value),580+i*65,top+39,62));
      } else {
        ctx.textAlign = "center";
        ctx.font = `600 28px ${FONT}`;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(String(row.played), W - 300, top + 39);
        ctx.fillText(`${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}`, W - 200, top + 39);
        ctx.font = `800 30px ${FONT}`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(row.points), W - 100, top + 39);
      }
    });

    y += group.rows.length * rowH + 28;
  }

  return toBlob(canvas);
}

export type LineupCardPlayer = { number?: string | number | null; name: string };

/** Starting eleven drawn on a pitch, with the bench listed underneath. */
export async function drawLineupCard(input: {
  team: string;
  logo?: string | null;
  competition?: string | null;
  formation: string;
  rows: LineupCardPlayer[][];
  bench: LineupCardPlayer[];
  coach?: string | null;
  accent?: string | null;
}): Promise<Blob | null> {
  const W = 1080;
  const benchRows = Math.ceil(Math.min(input.bench.length, 12) / 2);
  const H = 1180 + benchRows * 50 + (input.coach ? 60 : 0);
  const made = surface(W, H, input.accent || "#166534");
  if (!made) return null;
  const { canvas, ctx } = made;

  const logo = await loadImage(input.logo);
  crest(ctx, logo, input.team, 100, 108, 84);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(input.team.slice(0, 22), 165, 100);
  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText([input.competition, input.formation].filter(Boolean).join(" · ").slice(0, 44), 165, 146);

  // Pitch
  const px = 60;
  const py = 210;
  const pw = W - 120;
  const ph = 830;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 32);
  ctx.clip();
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#1b7a3f" : "#17703a";
    ctx.fillRect(px, py + (ph / 12) * i, pw, ph / 12);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(px + 18, py + 18, pw - 36, ph - 36);
  ctx.beginPath();
  ctx.moveTo(px + 18, py + ph / 2);
  ctx.lineTo(px + pw - 18, py + ph / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph / 2, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(px + pw / 2 - 150, py + 18, 300, 110);
  ctx.strokeRect(px + pw / 2 - 150, py + ph - 128, 300, 110);
  ctx.restore();

  const lines = input.rows.filter((row) => row.length > 0);
  const slotH = ph / Math.max(lines.length, 1);
  lines.forEach((row, ri) => {
    const cy = py + slotH * ri + slotH / 2;
    row.forEach((player, pi) => {
      const cx = px + (pw / (row.length + 1)) * (pi + 1);
      ctx.beginPath();
      ctx.arc(cx, cy - 18, 34, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText(String(player.number ?? ""), cx, cy - 7);
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(player.name.slice(0, 14), cx, cy + 42);
    });
  });

  let y = py + ph + 70;
  if (input.coach) {
    ctx.textAlign = "left";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`Coach · ${input.coach}`.slice(0, 40), 60, y);
    y += 60;
  }
  if (input.bench.length > 0) {
    ctx.textAlign = "left";
    ctx.font = `800 28px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("BENCH", 60, y);
    y += 44;
    input.bench.slice(0, 12).forEach((player, index) => {
      const column = index % 2;
      const rowIndex = Math.floor(index / 2);
      ctx.font = `600 28px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`${player.number ? `${player.number}. ` : ""}${player.name}`.slice(0, 24), 60 + column * (W / 2 - 40), y + rowIndex * 50);
    });
  }

  return toBlob(canvas);
}

export type LeaderboardCardRow = { name: string; sub?: string | null; image?: string | null; value: string };

/** Top-10 statistic leaderboard (goals, assists, ratings, cards) as a branded picture. */
export async function drawLeaderboardCard(input: { title: string; subtitle?: string | null; rows: LeaderboardCardRow[]; accent?: string | null }): Promise<Blob | null> {
  const W = 1080;
  const rowH = 92;
  const rows = input.rows.slice(0, 10);
  const H = Math.max(900, 290 + rows.length * rowH + 110);
  const made = surface(W, H, input.accent || "#1d4ed8");
  if (!made) return null;
  const { canvas, ctx } = made;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 62px ${FONT}`;
  ctx.fillText(input.title.slice(0, 26), 60, 135);
  if (input.subtitle) {
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(input.subtitle.slice(0, 46), 60, 188);
  }
  const images = await Promise.all(rows.map((r) => loadImage(r.image)));
  rows.forEach((row, i) => {
    const top = 250 + i * rowH;
    const leader = i === 0;
    ctx.fillStyle = leader ? "rgba(255,255,255,0.18)" : i % 2 === 0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)";
    roundRect(ctx, 50, top, W - 100, rowH - 12, 22);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = leader ? "#facc15" : "rgba(255,255,255,0.75)";
    ctx.fillText(String(i + 1), 92, top + 50);
    // round avatar
    const cx = 170, cy = top + 40, r = 30;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill(); ctx.clip();
    const img = images[i];
    if (img) {
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, cx - (img.width * s) / 2, cy - r, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath(); ctx.arc(cx, cy - 8, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + 26, 22, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.font = `700 32px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(row.name.slice(0, 24), 220, top + (row.sub ? 38 : 50));
    if (row.sub) {
      ctx.font = `500 24px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(row.sub.slice(0, 30), 220, top + 68);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = leader ? "#facc15" : "rgba(255,255,255,0.14)";
    roundRect(ctx, W - 190, top + 18, 110, 46, 14);
    ctx.fill();
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = leader ? "#0b1020" : "#ffffff";
    ctx.fillText(row.value, W - 135, top + 52);
  });
  return toBlob(canvas);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  return lines;
}

/** News story card: cover photo on top, headline and summary below. */
export async function drawNewsCard(input: { title: string; summary?: string | null; date?: string | null; cover?: string | null; rtl?: boolean }): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const made = surface(W, H, "#1d4ed8");
  if (!made) return null;
  const { canvas, ctx } = made;
  const img = await loadImage(input.cover);
  const coverH = 640;
  if (img) {
    // Keep the full original photo visible, inside a rounded card with a soft edge.
    const s = Math.min((W - 100) / img.width, coverH / img.height);
    const dw = img.width * s, dh = img.height * s;
    const dx = W / 2 - dw / 2, dy = 50 + coverH / 2 - dh / 2;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, dx, dy, dw, dh, 36);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, dx, dy, dw, dh, 36);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  let y = img ? coverH + 140 : 220;
  ctx.direction = input.rtl ? "rtl" : "ltr";
  ctx.textAlign = input.rtl ? "right" : "left";
  const x = input.rtl ? W - 70 : 70;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = "#facc15";
  ctx.fillText(input.rtl ? "أخبار" : "NEWS", x, y - 50);
  ctx.font = `800 58px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  for (const line of wrapLines(ctx, input.title, W - 140, 4)) { ctx.fillText(line, x, y); y += 72; }
  if (input.summary) {
    y += 16;
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    for (const line of wrapLines(ctx, input.summary, W - 140, 4)) { ctx.fillText(line, x, y); y += 46; }
  }
  if (input.date) {
    ctx.font = `600 26px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(input.date, x, H - 110);
  }
  ctx.direction = "ltr";
  return toBlob(canvas);
}


/** Both starting elevens on one branded match pitch, using the shared card surface. */
export async function drawMatchLineupsCard(input: {
  competition: string; kickoff: string; accent: string;
  teams: { teamName: string; logo?: string | null; formation: string; coach?: string | null; rows: { name: string; number: string; photo?: string | null }[][]; bench?: { name: string; number: string; photo?: string | null }[] }[];
}): Promise<Blob | null> {
  // Substitutes sit in two columns under the pitch; the card grows to fit them.
  const benchRows = Math.min(14, Math.max(0, ...input.teams.slice(0, 2).map((team) => team.bench?.length ?? 0)));
  const benchH = benchRows ? 110 + benchRows * 46 : 0;
  const W = 1080, H = 1760 + benchH;
  const made = surface(W, H, input.accent);
  if (!made) return null;
  const { canvas, ctx } = made;
  const teams = input.teams.slice(0, 2);
  const players = teams.flatMap((team) => team.rows.flat());
  const [logos, photos, mark] = await Promise.all([
    Promise.all(teams.map((team) => loadImage(team.logo))),
    Promise.all(players.map(async (player) => {
      const source = portraitSource(player.photo);
      const photo = await loadImage(source);
      return photo ?? (source !== player.photo ? await loadImage(player.photo) : null);
    })),
    loadImage(logoMark.url),
  ]);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText("Starting lineups", 60, 116);
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(input.competition.slice(0, 52), 60, 165);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(input.kickoff, 60, 205);
  const px = 60, py = 340, pw = 960, ph = 1220;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.clip();
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? "#122c30" : "#163438";
    ctx.fillRect(px, py + i * ph / 16, pw, ph / 16);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 22, py + 22, pw - 44, ph - 44);
  ctx.beginPath(); ctx.moveTo(px + 22, py + ph / 2); ctx.lineTo(px + pw - 22, py + ph / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, py + ph / 2, 95, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(W / 2 - 160, py + 22, 320, 125);
  ctx.strokeRect(W / 2 - 160, py + ph - 147, 320, 125);
  ctx.restore();
  let photoIndex = 0;
  teams.forEach((team, ti) => {
    const headerY = ti === 0 ? 280 : 1640;
    crest(ctx, logos[ti], team.teamName, 96, headerY, 58);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(team.teamName, 146, headerY + 10, 660);
    ctx.textAlign = "right";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(team.formation, 1010, headerY + 10);
    const rows = team.rows.filter((row) => row.length);
    rows.forEach((row, ri) => {
      // The source rows run attack to goalkeeper; each goalkeeper faces its own goal.
      const depth = (ri + 0.5) / rows.length;
      const cy = ti === 0 ? py + ph / 2 - depth * (ph / 2 - 36) : py + ph / 2 + depth * (ph / 2 - 36);
      row.forEach((player, pi) => {
        const cx = px + pw * (pi + 0.5) / row.length;
        const photo = photos[photoIndex++];
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy - 10, 36, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#26364b"; ctx.fillRect(cx - 36, cy - 46, 72, 72);
        if (photo) {
          const scale = Math.max(72 / photo.width, 72 / photo.height);
          ctx.drawImage(photo, cx - photo.width * scale / 2, cy - 10 - photo.height * scale / 2, photo.width * scale, photo.height * scale);
        } else {
          ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.font = `800 26px ${FONT}`;
          ctx.fillText(player.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(""), cx, cy);
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy - 10, 37, 0, Math.PI * 2);
        ctx.strokeStyle = ti === 0 ? "#60a5fa" : "#4ade80"; ctx.lineWidth = 3; ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = `700 22px ${FONT}`;
        const label = `${player.number}  ${player.name}`;
        const width = Math.min(pw / row.length - 10, ctx.measureText(label).width + 20);
        ctx.fillStyle = "rgba(11,16,32,0.88)";
        roundRect(ctx, cx - width / 2, cy + 33, width, 32, 8); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.fillText(label, cx, cy + 56, width - 12);
      });
    });
  });
  if (benchRows) {
    const top = 1700;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 60, top, 960, benchH - 30, 24); ctx.fill();
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `800 24px ${FONT}`;
    ctx.fillText("SUBSTITUTES", 92, top + 50);
    teams.forEach((team, ti) => {
      const x = ti === 0 ? 92 : 570;
      (team.bench ?? []).slice(0, benchRows).forEach((player, i) => {
        const y = top + 100 + i * 46;
        ctx.fillStyle = ti === 0 ? "#60a5fa" : "#4ade80";
        roundRect(ctx, x, y - 26, 48, 34, 8); ctx.fill();
        ctx.fillStyle = "#0b1020"; ctx.font = `800 20px ${FONT}`; ctx.textAlign = "center";
        ctx.fillText(player.number || "-", x + 24, y - 2);
        ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = `600 24px ${FONT}`;
        ctx.fillText(player.name, x + 62, y - 1, 380);
      });
    });
  }
  return toBlob(canvas);
}

type CardPlayer = { name: string; number: string; photo?: string | null; sub?: { minute: string; out: string } | null };

/** One club's starting eleven on a full pitch, with coach and substitutes. */
export async function drawTeamLineupCard(input: {
  possibleLineup?: boolean;
  competition: string; kickoff: string; accent: string;
  team: { teamName: string; logo?: string | null; formation: string; coach?: string | null; rows: CardPlayer[][]; bench?: CardPlayer[] };
}): Promise<Blob | null> {
  const { team } = input;
  const bench = (team.bench ?? []).slice(0, 14);
  const benchLines = Math.ceil(bench.length / 2);
  const benchH = bench.length ? 120 + benchLines * (bench.some((p) => p.sub) ? 66 : 50) : 0;
  const W = 1080, py = 300, ph = 1240, H = py + ph + 60 + benchH + 80;
  const made = surface(W, H, input.accent);
  if (!made) return null;
  const { canvas, ctx } = made;
  const players = team.rows.flat();
  const [logo, mark, ...photos] = await Promise.all([
    loadImage(team.logo), loadImage(logoMark.url),
    ...players.map(async (p) => { const src = portraitSource(p.photo); return (await loadImage(src)) ?? (src !== p.photo ? await loadImage(p.photo) : null); }),
  ]);
  crest(ctx, logo, team.teamName, 120, 130, 120);
  ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = `800 52px ${FONT}`;
  ctx.fillText(team.teamName, 210, 120, 640);
  ctx.font = `500 28px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(input.competition.slice(0, 48), 210, 165, 640);
  ctx.font = `500 24px ${FONT}`; ctx.fillText(input.kickoff, 210, 202, 640);
  if (input.possibleLineup) { ctx.textAlign="left"; ctx.fillStyle="#ffffff"; ctx.font=`800 28px ${FONT}`; ctx.fillText("POSSIBLE LINEUP",60,267); }
  ctx.textAlign = "right"; ctx.fillStyle = "#ffffff"; ctx.font = `800 40px ${FONT}`;
  ctx.fillText(team.formation, 1020, 120);
  if (team.coach) { ctx.font = `600 24px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,0.72)"; ctx.fillText(`Coach · ${team.coach}`, 1020, 165, 360); }

  const px = 60, pw = 960;
  ctx.save(); roundRect(ctx, px, py, pw, ph, 32); ctx.clip();
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? "#14532d" : "#166534"; ctx.fillRect(px, py + i * ph / 14, pw, ph / 14); }
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 4;
  ctx.strokeRect(px + 24, py + 24, pw - 48, ph - 48);
  ctx.beginPath(); ctx.moveTo(px + 24, py + 24); ctx.arc(W / 2, py + 24, 110, 0, Math.PI); ctx.stroke();
  ctx.strokeRect(W / 2 - 200, py + ph - 224, 400, 200);
  ctx.strokeRect(W / 2 - 90, py + ph - 94, 180, 70);
  ctx.restore();

  const rows = team.rows.filter((r) => r.length);
  let k = 0;
  rows.forEach((row, ri) => {
    // Rows run attack to goalkeeper: attackers at the top, keeper by its own goal.
    const cy = py + 130 + (ri / Math.max(1, rows.length - 1)) * (ph - 300);
    row.forEach((player, pi) => {
      const cx = px + pw * (pi + 0.5) / row.length;
      const photo = photos[k++];
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "#0f172a"; ctx.fillRect(cx - 52, cy - 52, 104, 104);
      if (photo) { const sc = Math.max(104 / photo.width, 104 / photo.height); ctx.drawImage(photo, cx - photo.width * sc / 2, cy - photo.height * sc / 2, photo.width * sc, photo.height * sc); }
      else { ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.font = `800 34px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillText(player.number || player.name.slice(0, 1), cx, cy); ctx.textBaseline = "alphabetic"; }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, 53, 0, Math.PI * 2); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
      if (player.number) {
        ctx.fillStyle = input.accent; ctx.beginPath(); ctx.arc(cx + 40, cy - 40, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = `800 20px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(player.number, cx + 40, cy - 33);
      }
      ctx.font = `700 24px ${FONT}`; ctx.textAlign = "center";
      const w = Math.min(pw / row.length - 12, ctx.measureText(player.name).width + 24);
      ctx.fillStyle = "rgba(11,16,32,0.9)"; roundRect(ctx, cx - w / 2, cy + 62, w, 38, 10); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.fillText(player.name, cx, cy + 89, w - 14);
    });
  });

  if (bench.length) {
    const top = py + ph + 40;
    const lineH = bench.some((p) => p.sub) ? 66 : 50;
    ctx.fillStyle = "rgba(255,255,255,0.07)"; roundRect(ctx, 60, top, 960, benchH, 28); ctx.fill();
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `800 24px ${FONT}`;
    ctx.fillText("SUBSTITUTES", 96, top + 56);
    bench.forEach((p, i) => {
      const x = i % 2 ? 560 : 96, y = top + 110 + Math.floor(i / 2) * lineH;
      if (p.sub) {
        // Came-on card: minute, number chip with a green up arrow, name in
        // green and the replaced player in grey underneath.
        ctx.textAlign = "right"; ctx.font = `700 24px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(p.sub.minute, x + 40, y - 2);
        ctx.fillStyle = input.accent; roundRect(ctx, x + 52, y - 34, 48, 34, 9); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = `800 20px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(p.number || "-", x + 76, y - 10);
        ctx.fillStyle = "#4ade80"; ctx.beginPath(); ctx.moveTo(x + 76, y - 2); ctx.lineTo(x + 68, y + 10); ctx.lineTo(x + 84, y + 10); ctx.closePath(); ctx.fill();
        ctx.textAlign = "left"; ctx.font = `700 26px ${FONT}`; ctx.fillStyle = "#4ade80"; ctx.fillText(p.name, x + 118, y - 10, 340);
        if (p.sub.out) { ctx.font = `500 22px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText(p.sub.out, x + 118, y + 18, 340); }
      } else {
        ctx.fillStyle = input.accent; roundRect(ctx, x, y - 28, 52, 36, 9); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = `800 20px ${FONT}`; ctx.textAlign = "center"; ctx.fillText(p.number || "-", x + 26, y - 3);
        ctx.textAlign = "left"; ctx.font = `600 26px ${FONT}`; ctx.fillText(p.name, x + 68, y - 1, 380);
      }
    });
  }
  return toBlob(canvas);
}

/** Full-time (or live) result card: crests, big score, scorers and branding. */
export async function drawResultCard(input: {
  competition: string; kickoff: string; status: string; accent: string; accentAway: string;
  home: { name: string; logo?: string | null }; away: { name: string; logo?: string | null };
  homeScore: string; awayScore: string;
  homeScorers: { name: string; minute: string }[]; awayScorers: { name: string; minute: string }[];
}): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const made = surface(W, H, input.accent);
  if (!made) return null;
  const { canvas, ctx } = made;
  const glow = ctx.createRadialGradient(W, 0, 40, W, 0, 900);
  glow.addColorStop(0, input.accentAway); glow.addColorStop(1, "rgba(11,16,32,0)");
  ctx.fillStyle = glow; ctx.globalAlpha = 0.6; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  const [hl, al, mark, goalImg] = await Promise.all([loadImage(input.home.logo), loadImage(input.away.logo), loadImage(logoMark.url), loadImage(goalIcon)]);

  ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = `700 32px ${FONT}`;
  ctx.fillText(input.competition.slice(0, 48).toUpperCase(), W / 2, 110);
  ctx.font = `500 26px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText(input.kickoff, W / 2, 152);

  ctx.fillStyle = "rgba(255,255,255,0.08)"; roundRect(ctx, 60, 210, 960, 560, 40); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2; ctx.stroke();
  const plate = (img: HTMLImageElement | null, name: string, cx: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath(); ctx.arc(cx, 400, 112, 0, Math.PI * 2); ctx.fill();
    crest(ctx, img, name, cx, 400, 150);
    ctx.fillStyle = "#ffffff"; ctx.font = `800 36px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(name.slice(0, 20), cx, 570, 340);
  };
  plate(hl, input.home.name, 250); plate(al, input.away.name, W - 250);
  ctx.fillStyle = "#ffffff"; ctx.font = `900 132px ${FONT}`; ctx.textAlign = "center";
  ctx.fillText(input.homeScore === "" ? "VS" : `${input.homeScore}-${input.awayScore}`, W / 2, 445);
  ctx.font = `800 26px ${FONT}`; const sw = ctx.measureText(input.status.toUpperCase()).width + 48;
  ctx.fillStyle = input.accent; roundRect(ctx, W / 2 - sw / 2, 640, sw, 52, 26); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.fillText(input.status.toUpperCase(), W / 2, 675);

  const list = (items: { name: string; minute: string }[], x: number, align: CanvasTextAlign) => {
    ctx.textAlign = align; ctx.font = `600 30px ${FONT}`;
    items.slice(0, 9).forEach((s, i) => { ctx.fillStyle = "#ffffff"; ctx.fillText(`${s.name}  ${s.minute}`, x, 870 + i * 52, 430); });
  };
  if (input.homeScorers.length || input.awayScorers.length) {
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = `800 22px ${FONT}`; ctx.fillText("GOALS", W / 2 + 20, 820);
    if (goalImg) crest(ctx, goalImg, "", W / 2 - 52, 812, 34);
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(W / 2 - 1, 845, 2, 460);
    list(input.homeScorers, W / 2 - 40, "right"); list(input.awayScorers, W / 2 + 40, "left");
  }
  return toBlob(canvas);
}
