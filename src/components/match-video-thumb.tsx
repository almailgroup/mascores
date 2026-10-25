import { useEffect, useState } from "react";

function load(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** League thumbnail background with both club logos and the score composited on top. */
export function MatchVideoThumb({ background, leagueLogo, homeLogo, awayLogo, score, className = "" }: { background?: string | null; leagueLogo?: string | null; homeLogo?: string | null; awayLogo?: string | null; score: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [bg, h, a, lg] = await Promise.all([load(background), load(homeLogo), load(awayLogo), background ? Promise.resolve(null) : load(leagueLogo)]);
      const W = 1280, H = 720;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d"); if (!ctx) return;
      if (bg) { const s = Math.max(W / bg.width, H / bg.height); ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s); }
      else {
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#16224a"); g.addColorStop(1, "#0b1020");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (lg) { const s = 120 / Math.max(lg.width, lg.height); ctx.drawImage(lg, W / 2 - (lg.width * s) / 2, 70, lg.width * s, lg.height * s); }
      }
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);
      const logo = (img: HTMLImageElement | null, cx: number) => { if (!img) return; const s = 260 / Math.max(img.width, img.height); ctx.drawImage(img, cx - (img.width * s) / 2, H / 2 - (img.height * s) / 2, img.width * s, img.height * s); };
      logo(h, 260); logo(a, W - 260);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 150px system-ui, -apple-system, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 20;
      ctx.fillText(score, W / 2, H / 2);
      try { const url = c.toDataURL("image/jpeg", 0.85); if (alive) setSrc(url); } catch { /* tainted canvas */ }
    })();
    return () => { alive = false; };
  }, [background, leagueLogo, homeLogo, awayLogo, score]);
  if (!src) return <div className={`aspect-video w-full animate-pulse bg-muted ${className}`} />;
  return <img src={src} alt="" className={`aspect-video w-full object-cover ${className}`} />;
}
