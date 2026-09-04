import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, X, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type ShareTeam = { name?: string | null; logo_url?: string | null };
export type ShareScorer = { name: string; minute: string };
export type ShareLineupPlayer = { number: string; name: string };

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

/** Draws the branded share card: match result, or the two starting elevens. */
async function drawCard(data: MatchShareData, mode: "result" | "lineups"): Promise<Blob | null> {
  const W = 1080;
  const H = mode === "lineups" ? 1350 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const accent = data.accent || "#123a8a";
  const accentAway = data.accentAway || accent;
  // Left side wears the home colour, right side the away colour.
  const gradient = ctx.createLinearGradient(0, 0, W, H * 0.25);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, accentAway);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, W, H);

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

  if (mode === "result") {
    ctx.font = "500 30px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "right";
    data.homeScorers.slice(0, 8).forEach((scorer, index) => ctx.fillText(`${scorer.name} ${scorer.minute}`, W / 2 - 60, 540 + index * 46));
    ctx.textAlign = "left";
    data.awayScorers.slice(0, 8).forEach((scorer, index) => ctx.fillText(`${scorer.name} ${scorer.minute}`, W / 2 + 60, 540 + index * 46));
  } else {
    const columns: [ShareLineupPlayer[], number, CanvasTextAlign][] = [
      [data.homeLineup.slice(0, 11), 90, "left"],
      [data.awayLineup.slice(0, 11), W - 90, "right"],
    ];
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 50, 500, W - 100, 760, 36);
    ctx.fill();
    ctx.restore();
    for (const [list, x, align] of columns) {
      ctx.textAlign = align;
      list.forEach((player, index) => {
        ctx.font = "500 30px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(`${player.number ? player.number + ". " : ""}${player.name}`.slice(0, 24), x, 560 + index * 64);
      });
    }
  }

  ctx.textAlign = "center";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("MansourAlmailScores", W / 2, H - 50);

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

  const share = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], "match.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: `${data.home.name} ${data.homeScore}-${data.awayScore} ${data.away.name}` }); return; } catch { /* cancelled */ }
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "match.png";
    link.click();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label("Share match", "مشاركة المباراة")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
        <Share2 className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
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
                : <img src={preview} alt="" className="w-full" />}
            </div>
            <button type="button" disabled={busy || !preview} onClick={share}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              <Download className="h-4 w-4" /> {label("Share image", "مشاركة الصورة")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
