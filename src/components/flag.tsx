import { findCountry, BIDOON_CODE } from "@/lib/countries";

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
  // Stateless residents have no ISO flag — draw a wordmark flag instead.
  if (c.code === BIDOON_CODE) {
    return (
      <span
        title={c.name}
        aria-label={c.name}
        className={`${SIZES[size]} ${TEXT_SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-[2px] bg-muted font-black leading-none text-foreground ring-1 ring-black/10 ${className}`}
      >
        بدون
      </span>
    );
  }
  const code = c.code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={`${c.name} flag`}
      title={c.name}
      loading="lazy"
      className={`${SIZES[size]} shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 ${className}`}
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
