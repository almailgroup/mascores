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

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
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
}): Promise<Blob | null> {
  const W = 1080;
  const rowH = 68;
  const groups = input.groups.map((g) => ({ ...g, rows: g.rows.slice(0, 22) }));
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
      ctx.fillText(row.name.slice(0, 22), 175, top + 39);

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
    ctx.save();
    roundRect(ctx, 50, 50, W - 100, coverH, 32); ctx.clip();
    const s = Math.max((W - 100) / img.width, coverH / img.height);
    ctx.drawImage(img, W / 2 - (img.width * s) / 2, 50 + coverH / 2 - (img.height * s) / 2, img.width * s, img.height * s);
    const fade = ctx.createLinearGradient(0, 50 + coverH - 200, 0, 50 + coverH);
    fade.addColorStop(0, "rgba(11,16,32,0)"); fade.addColorStop(1, "rgba(11,16,32,0.85)");
    ctx.fillStyle = fade; ctx.fillRect(50, 50, W - 100, coverH);
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
