import { useTheme } from "@/components/theme-provider";

type LogoSource = { logo_url?: string | null; logo_url_dark?: string | null } | null | undefined;

/** Pick the competition logo that suits the active theme, falling back to the other one. */
export function useCompetitionLogo() {
  const { theme } = useTheme();
  return (competition: LogoSource) => {
    if (!competition) return null;
    const dark = competition.logo_url_dark ?? null;
    const light = competition.logo_url ?? null;
    return (theme === "dark" ? dark ?? light : light ?? dark) ?? null;
  };
}
