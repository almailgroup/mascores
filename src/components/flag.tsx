import { findCountry, BIDOON_CODE } from "@/lib/countries";
import { Globe } from "lucide-react";

// Bundle maintained flag artwork locally: no third-party requests or expired URLs.
const FLAG_ASSETS = import.meta.glob<string>("../../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const FLAG_CODES: Record<string, string> = { AC: "sh-ac", TA: "sh-ta", EA: "es", EZ: "eu" };

const SIZES = { xs: "h-3 w-[1.125rem]", sm: "h-3.5 w-[1.3rem]", md: "h-4 w-6", lg: "h-5 w-7" } as const;
const TEXT_SIZES = { xs: "text-[0.4rem]", sm: "text-[0.45rem]", md: "text-[0.5rem]", lg: "text-[0.6rem]" } as const;

/** Real flag image (not the OS emoji font) rendered from an ISO country code. */
export function FlagIcon({
  value,
  size = "sm",
  className = "",
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const c = findCountry(value);
  if (!c) return null;
  // People without a nationality have no ISO flag — show a neutral mark.
  if (c.code === BIDOON_CODE) {
    return (
      <span
        title={c.name}
        aria-label={c.name}
        className={`${SIZES[size]} ${TEXT_SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-[2px] bg-muted font-black leading-none text-foreground ring-1 ring-border ${className}`}
      >
        —
      </span>
    );
  }
  const code = FLAG_CODES[c.code] ?? c.code.toLowerCase();
  const src = FLAG_ASSETS[`../../node_modules/flag-icons/flags/4x3/${code}.svg`];
  if (!src) return <Globe role="img" aria-label={c.name} className={`${SIZES[size]} shrink-0 text-muted-foreground ${className}`} />;
  return (
    <img
      src={src}
      alt={`${c.name} flag`}
      title={c.name}
      className={`${SIZES[size]} shrink-0 rounded-[2px] object-fill ring-1 ring-border ${className}`}
    />
  );
}

/** Flag image + country name. */
export function FlagLabel({
  value,
  size = "sm",
  className = "",
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const c = findCountry(value);
  if (!c) return value ? <span className={className}>{value}</span> : null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FlagIcon value={c.code} size={size} />
      <span className="truncate">{c.name}</span>
    </span>
  );
}
