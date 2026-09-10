import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, X, Download, ImageDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type ShareTeam = { name?: string | null; logo_url?: string | null };
export type ShareScorer = { name: string; minute: string };
export type ShareLineupPlayer = { number: string; name: string };

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
  accent: string;
  accentAway?: string;
};

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
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

const BRAND = "Mansour Almail Scores";

/** Draws the branded share card: match result, or one club's line-up on a pitch. */
async function drawCard(data: MatchShareData, mode: "result" | "lineups"): Promise<Blob | null> {
  const W = 1080;
  const lineup = data.lineup ?? null;
  const benchCount = Math.min(lineup?.bench.length ?? 0, 10);
  const H = mode === "lineups" ? 1180 + benchCount * 48 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const accent = safeColor(data.accent, "#16224a");
  const accentAway = safeColor(data.accentAway, accent);

  if (mode === "lineups" && lineup) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, W, H);

    const logo = await loadImage(lineup.logo);
    if (logo) {
      const size = 96;
      const scale = Math.min(size / logo.width, size / logo.height);
      ctx.drawImage(logo, 60, 56, logo.width * scale, logo.height * scale);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 46px system-ui, -apple-system, sans-serif";
    ctx.fillText(lineup.teamName.slice(0, 24), 176, 104);
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`${data.competition.slice(0, 40)}`, 176, 144);

    // Formation pill
    ctx.textAlign = "right";
    ctx.font = "800 40px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(lineup.formation, W - 60, 116);

    // Pitch
    const px = 60, py = 200, pw = W - 120, ph = 900;
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 32);
    ctx.clip();
    for (let i = 0; i * 60 < ph; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "#1b7a3f" : "#17703a";
      ctx.fillRect(px, py + i * 60, pw, 60);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(px + 16, py + 16, pw - 32, ph - 32);
    ctx.beginPath();
    ctx.moveTo(px + 16, py + ph / 2);
    ctx.lineTo(px + pw - 16, py + ph / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph / 2, 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(px + pw / 2 - 150, py + 16, 300, 110);
    ctx.strokeRect(px + pw / 2 - 150, py + ph - 126, 300, 110);
    ctx.restore();

    // Players by formation row (goalkeeper row last, closest to the near goal)
    const rows = lineup.rows.filter((row) => row.length > 0);
    const rowHeight = (ph - 120) / Math.max(rows.length, 1);
    rows.forEach((row, ri) => {
      const cy = py + 70 + rowHeight * ri + rowHeight / 2;
      const step = pw / (row.length + 1);
      row.forEach((player, ci) => {
        const cx = px + step * (ci + 1);
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 30px system-ui, sans-serif";
        ctx.fillText(player.number || "-", cx, cy + 1);
        ctx.textBaseline = "alphabetic";
        ctx.font = "700 24px system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(player.name.slice(0, 16), cx, cy + 66);
      });
    });

    let y = py + ph + 60;
    if (lineup.coach) {
      ctx.textAlign = "left";
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("COACH", 60, y);
      ctx.font = "700 32px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(lineup.coach.slice(0, 30), 200, y + 2);
      y += 56;
    }
    if (benchCount > 0) {
      ctx.textAlign = "left";
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("BENCH", 60, y);
      y += 44;
      ctx.font = "600 28px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      lineup.bench.slice(0, benchCount).forEach((player, index) => {
        const column = index % 2;
        const line = Math.floor(index / 2);
        ctx.fillText(`${player.number ? player.number + "  " : ""}${player.name}`.slice(0, 24), 60 + column * (W / 2 - 40), y + line * 44);
      });
    }

    ctx.textAlign = "center";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(BRAND, W / 2, H - 34);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
  }

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
  ctx.fillText(`${data.homeScore} - ${data.awayScore}`, W / 2, 320);
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

  ctx.textAlign = "center";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(BRAND, W / 2, H2 - 50);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}

/** Share control plus the "looks like you took a screenshot" prompt. */
export function MatchShare({ data, mode }: { data: MatchShareData; mode: "result" | "lineups" }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const label = (en: string, ar: string) => (lang === "ar" ? ar : en);

  const build = useCallback(async () => {
    setBusy(true);
    const blob = await drawCard(data, mode);
    blobRef.current = blob;
    setPreview(blob ? URL.createObjectURL(blob) : null);
    setBusy(false);
  }, [data, mode]);

  useEffect(() => {
    if (open) void build();
  }, [open, build]);

  // Screenshot hints: desktop print-screen / macOS capture shortcuts, and the
  // quick blur-then-focus that iOS produces while the capture flash happens.
  useEffect(() => {
    let blurAt = 0;
    const onKey = (event: KeyboardEvent) => {
      const macCapture = (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(event.key));
      if (event.key === "PrintScreen" || macCapture) setOpen(true);
    };
    const onBlur = () => { blurAt = Date.now(); };
    const onFocus = () => { if (blurAt && Date.now() - blurAt < 1200) setOpen(true); blurAt = 0; };
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("keyup", onKey); window.removeEventListener("blur", onBlur); window.removeEventListener("focus", onFocus); };
  }, []);

  const title = `${data.home.name ?? ""} ${data.homeScore}-${data.awayScore} ${data.away.name ?? ""}`.trim();
  const fileName = `${title.replace(/[^\w\u0600-\u06FF -]/g, "").replace(/\s+/g, "-") || "match"}.png`;

  const saveToFile = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  /** iOS/Android share sheet: this is where "Save Image" adds it to the camera roll. */
  const saveToPhotos = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title }); return; } catch { return; /* cancelled */ }
    }
    saveToFile();
  };




  return (
    <>
      {mode === "lineups" ? (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">
          <Share2 className="h-4 w-4" /> {label("Share line-ups", "مشاركة التشكيلة")}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label={label("Share match", "مشاركة المباراة")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
          <Share2 className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">{label("Share this match?", "مشاركة هذه المباراة؟")}</div>
                <div className="text-xs text-muted-foreground">
                  {mode === "lineups" ? label("Line-ups image", "صورة التشكيلة") : label("Result image", "صورة النتيجة")}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              {busy || !preview
                ? <div className="grid h-56 place-items-center text-xs text-muted-foreground">{label("Creating image…", "جارٍ إنشاء الصورة…")}</div>
                : <img src={preview} alt="" className="mx-auto max-h-[34vh] w-full object-contain" />}
            </div>
            <button type="button" disabled={busy || !preview} onClick={saveToPhotos}
              className="sticky bottom-0 mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              <ImageDown className="h-4 w-4" /> {label("Save to photos", "حفظ في الصور")}
            </button>
            <button type="button" disabled={busy || !preview} onClick={saveToFile}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              <Download className="h-4 w-4" /> {label("Save file", "حفظ الملف")}
            </button>
            {/* Clears the bottom navigation bar so the actions stay tappable. */}
            <div className="h-24 sm:h-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          </div>
        </div>
      )}
    </>
  );
}
