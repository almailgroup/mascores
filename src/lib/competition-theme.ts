import type { CSSProperties } from "react";
import zainBg from "@/assets/zain-bg.jpg.asset.json";

/**
 * Per-competition visual identity. A themed competition repaints its page with
 * the sponsor palette and plays a short intro when you open it.
 */
export type CompetitionTheme = {
  key: string;
  /** Token overrides applied to the whole competition page. */
  vars: CSSProperties;
  /** Hero background behind the competition header (full CSS background value). */
  hero: string;
  /** Full-page background wash for the themed competition page. */
  page: string;
  /** Glow used by the intro animation. */
  glow: string;
};

const ZAIN_GRADIENT =
  "linear-gradient(160deg, oklch(0.68 0.12 210) 0%, oklch(0.58 0.15 236) 45%, oklch(0.48 0.16 252) 100%)";

const ZAIN: CompetitionTheme = {
  key: "zain",
  vars: {
    "--primary": "oklch(0.55 0.16 245)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--ring": "oklch(0.6 0.15 240)",
    "--accent": "oklch(0.93 0.05 235)",
    "--accent-foreground": "oklch(0.28 0.12 245)",
  } as CSSProperties,
  hero: `url("${zainBg.url}") center/cover no-repeat, ${ZAIN_GRADIENT}`,
  page: "linear-gradient(180deg, color-mix(in oklab, oklch(0.58 0.15 236) 12%, transparent) 0%, transparent 320px)",
  glow: "oklch(0.66 0.15 230)",
};

/** Returns the theme for a competition, or null when it uses the default look. */
export function competitionTheme(input: { slug?: string | null; name?: string | null }): CompetitionTheme | null {
  const haystack = `${input.slug ?? ""} ${input.name ?? ""}`.toLowerCase();
  if (haystack.includes("zain")) return ZAIN;
  return null;
}
