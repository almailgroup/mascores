import type { CSSProperties } from "react";
import zainBg from "@/assets/zain-bg.jpg.asset.json";

/**
 * Per-competition visual identity. A themed competition repaints its page with
 * the sponsor palette and plays a short intro when you open it.
 */
export type CompetitionTheme = {
  key: string;
  /** Token overrides applied to the whole competition page (cards, text, borders). */
  vars: CSSProperties;
  /** Hero background behind the competition header (full CSS background value). */
  hero: string;
  /** Full-page background wash for the themed competition page. */
  page: string;
  /** Fixed artwork layer painted behind the whole themed page. */
  backdrop: string;
  /** Glow used by the intro animation. */
  glow: string;
};

const ZAIN_GRADIENT =
  "linear-gradient(160deg, oklch(0.68 0.12 210) 0%, oklch(0.58 0.15 236) 45%, oklch(0.48 0.16 252) 100%)";

const ZAIN: CompetitionTheme = {
  key: "zain",
  vars: {
    "--background": "oklch(0.972 0.017 231)",
    "--foreground": "oklch(0.31 0.09 252)",
    "--card": "oklch(0.995 0.006 231)",
    "--card-foreground": "oklch(0.31 0.09 252)",
    "--popover": "oklch(0.995 0.006 231)",
    "--popover-foreground": "oklch(0.31 0.09 252)",
    "--muted": "oklch(0.945 0.028 232)",
    "--muted-foreground": "oklch(0.5 0.07 246)",
    "--border": "oklch(0.885 0.033 234)",
    "--input": "oklch(0.885 0.033 234)",
    "--secondary": "oklch(0.94 0.03 232)",
    "--secondary-foreground": "oklch(0.31 0.09 252)",
    "--primary": "oklch(0.55 0.16 245)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--ring": "oklch(0.6 0.15 240)",
    "--accent": "oklch(0.93 0.05 235)",
    "--accent-foreground": "oklch(0.28 0.12 245)",
  } as CSSProperties,
  hero: `url("${zainBg.url}") center/cover no-repeat, ${ZAIN_GRADIENT}`,
  page: "linear-gradient(180deg, color-mix(in oklab, oklch(0.58 0.15 236) 14%, transparent) 0%, transparent 420px)",
  backdrop: `url("${zainBg.url}") center top/cover no-repeat`,
  glow: "oklch(0.66 0.15 230)",
};

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
