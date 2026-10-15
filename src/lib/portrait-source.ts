type Asset = { url: string };
const portraits = import.meta.glob<Asset>("../assets/portraits/*.asset.json", { eager: true, import: "default" });

/** Compact CDN copies preserve original photos and reuse browser caching. */
export function portraitSource(source: string | null | undefined): string | undefined {
  if (!source) return undefined;
  try {
    const path = new URL(source, "https://mascores.live").pathname;
    const name = path.split("/").pop();
    if (!name) return source;
    return portraits[`../assets/portraits/${name}.webp.asset.json`]?.url ?? source;
  } catch { return source; }
}