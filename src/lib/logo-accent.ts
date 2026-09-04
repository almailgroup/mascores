import { useEffect, useState } from "react";

/**
 * Reads the dominant colour out of a competition logo so the page header can be
 * tinted with the competition's own identity (a yellow badge gives a yellow
 * header) instead of one fixed navy band.
 */
export type LogoAccent = { hero: string; onLight: boolean; color: string };

const cache = new Map<string, LogoAccent | null>();

export function useLogoAccent(url: string | null | undefined): LogoAccent | null {
  const [accent, setAccent] = useState<LogoAccent | null>(() => (url ? cache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) {
      setAccent(null);
      return;
    }
    if (cache.has(url)) {
      setAccent(cache.get(url) ?? null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const result = extract(img);
      cache.set(url, result);
      if (!cancelled) setAccent(result);
    };
    img.onerror = () => {
      cache.set(url, null);
      if (!cancelled) setAccent(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return accent;
}

function extract(img: HTMLImageElement): LogoAccent | null {
  try {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    // Bucket saturated pixels by hue and keep the heaviest bucket, so the badge's
    // brand colour wins over white paper and thin black outlines.
    const buckets = new Map<number, { r: number; g: number; b: number; n: number; w: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 140) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (max < 30 || (sat < 0.22 && max > 215)) continue; // skip near-black and near-white
      const weight = sat * (max / 255);
      const hue = Math.round(hueOf(r, g, b) / 20);
      const cur = buckets.get(hue) ?? { r: 0, g: 0, b: 0, n: 0, w: 0 };
      cur.r += r * weight; cur.g += g * weight; cur.b += b * weight; cur.n += 1; cur.w += weight;
      buckets.set(hue, cur);
    }
    let best: { r: number; g: number; b: number; w: number } | null = null;
    for (const bucket of buckets.values()) {
      if (bucket.w <= 0) continue;
      if (!best || bucket.w > best.w) best = { r: bucket.r / bucket.w, g: bucket.g / bucket.w, b: bucket.b / bucket.w, w: bucket.w };
    }
    if (!best) return null;

    const [h, s, l] = rgbToHsl(best.r, best.g, best.b);
    // Keep the hue, normalise brightness so text stays readable on any brand colour.
    const light = l > 0.62 && s > 0.35; // bright yellows/limes need dark text
    const base = light
      ? { h, s: Math.min(1, s * 1.05), l: 0.62 }
      : { h, s: Math.max(0.35, Math.min(0.95, s)), l: Math.min(0.42, Math.max(0.24, l)) };
    const from = hsl(base.h, base.s, light ? base.l + 0.08 : base.l + 0.06);
    const to = hsl(base.h, base.s * 0.92, light ? base.l - 0.06 : Math.max(0.14, base.l - 0.12));
    return { hero: `linear-gradient(150deg, ${from} 0%, ${to} 100%)`, onLight: light, color: hsl(base.h, Math.max(0.45, base.s), light ? 0.5 : 0.45) };
  } catch {
    return null;
  }
}

function hueOf(r: number, g: number, b: number) {
  return rgbToHsl(r, g, b)[0];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h = ((h * 60) + 360) % 360;
  return [h, s, l];
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)} ${Math.round(Math.max(0, Math.min(1, s)) * 100)}% ${Math.round(Math.max(0, Math.min(1, l)) * 100)}%)`;
}
