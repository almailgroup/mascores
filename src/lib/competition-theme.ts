import type { CSSProperties } from "react";

/**
 * Per-competition visual identity. A themed competition repaints its page with
 * the sponsor palette and plays a short intro when you open it.
 */
export type CompetitionTheme = {
  key: string;
  /** Token overrides applied to the whole competition page. */
  vars: CSSProperties;
  /** Hero gradient behind the competition header. */
  hero: string;
  /** Glow used by the intro animation. */
  glow: string;
};

const ZAIN: CompetitionTheme = {
  key: "zain",
  vars: {
    "--primary": "oklch(0.52 0.26 320)",
    "--primary-foreground": "oklch(0.99 0 0)",
    "--ring": "oklch(0.52 0.26 320)",
    "--accent": "oklch(0.94 0.05 320)",
    "--accent-foreground": "oklch(0.28 0.16 320)",
  } as CSSProperties,
  hero: "linear-gradient(135deg, oklch(0.42 0.24 318) 0%, oklch(0.55 0.27 322) 55%, oklch(0.68 0.2 340) 100%)",
  glow: "oklch(0.6 0.27 322)",
};

/** Returns the theme for a competition, or null when it uses the default look. */
export function competitionTheme(input: { slug?: string | null; name?: string | null }): CompetitionTheme | null {
  const haystack = `${input.slug ?? ""} ${input.name ?? ""}`.toLowerCase();
  if (haystack.includes("zain")) return ZAIN;
  return null;
}
