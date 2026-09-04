import type { CSSProperties } from "react";
import zainBg from "@/assets/zain-bg.jpg.asset.json";

/**
 * Per-competition visual identity.
 *
 * A themed competition only restyles its hero header and accent colour — it no
 * longer repaints every card on the page, which made text and surfaces look
 * washed out, and it no longer plays an entry animation.
 */
export type CompetitionTheme = {
  key: string;
  /** Accent overrides scoped to the competition page. */
  vars: CSSProperties;
  /** Hero background behind the competition header (full CSS background value). */
  hero: string;
};

const ZAIN: CompetitionTheme = {
  key: "zain",
  vars: {
    "--primary": "oklch(0.55 0.17 245)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--ring": "oklch(0.6 0.15 240)",
  } as CSSProperties,
  // The photo sits under a deep navy wash so the white header text stays legible.
  hero: `linear-gradient(150deg, oklch(0.2 0.06 262 / 0.92) 0%, oklch(0.24 0.09 255 / 0.86) 45%, oklch(0.34 0.14 250 / 0.82) 100%), url("${zainBg.url}") center/cover no-repeat`,
};

/** Default hero used by every non-themed competition. */
export const DEFAULT_HERO =
  "linear-gradient(150deg, oklch(0.19 0.05 262) 0%, oklch(0.23 0.07 258) 55%, oklch(0.29 0.11 255) 100%)";

/**
 * Returns the theme for a competition, or null when it uses the default look.
 * Only the Zain Premier League is themed — lower Zain divisions keep the
 * standard look, so the sponsor identity stays tied to the top tier.
 */
export function competitionTheme(input: { slug?: string | null; name?: string | null }): CompetitionTheme | null {
  const haystack = `${input.slug ?? ""} ${input.name ?? ""}`.toLowerCase();
  if (!haystack.includes("zain")) return null;
  if (/(first|second|third|1st|2nd|division|div\b|u\d{2}|youth|reserve)/.test(haystack)) return null;
  if (haystack.includes("premier")) return ZAIN;
  return null;
}
