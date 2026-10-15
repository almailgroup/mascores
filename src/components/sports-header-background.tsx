import type { CSSProperties } from "react";

type HeaderColors = CSSProperties & {
  "--header-tint-start": string;
  "--header-tint-end": string;
  "--header-custom-background"?: string;
};

/** Shared, non-interactive backdrop; sampled identity colours remain data, not theme tokens. */
export function SportsHeaderBackground({ start, end, background }: {
  start?: string | null;
  end?: string | null;
  background?: string | null;
}) {
  const colors: HeaderColors = {
    "--header-tint-start": start ?? "var(--primary)",
    "--header-tint-end": end ?? start ?? "var(--primary)",
    ...(background ? { "--header-custom-background": background } : {}),
  };
  return <div aria-hidden="true" className="sports-header-background" style={colors} />;
}