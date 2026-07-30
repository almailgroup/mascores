import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, findCountry, searchCountries, type Country } from "@/lib/countries";

export function CountryFlag({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const c = findCountry(value);
  if (!c) return null;
  return <span className={className} title={c.name} aria-hidden>{c.flag}</span>;
}

export function CountryTag({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const c = findCountry(value);
  if (!c) return value ? <span className={className}>{value}</span> : null;
  return <span className={`inline-flex items-center gap-1 ${className}`}><span aria-hidden>{c.flag}</span>{c.name}</span>;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Search a country…",
}: {
  value: string | null | undefined;
  onChange: (name: string | null, country: Country | null) => void;
  placeholder?: string;
}) {
  const selected = findCountry(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => (open ? searchCountries(query) : []), [open, query]);

  return (
    <div className="relative" ref={boxRef}>
      <div
        className="flex w-full cursor-text items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-within:border-primary"
        onClick={() => setOpen(true)}
      >
        {selected && <span aria-hidden className="text-base leading-none">{selected.flag}</span>}
        <input
          className="w-full bg-transparent outline-none"
          value={open ? query : (selected?.name ?? value ?? "")}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {(selected || value) && (
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); setQuery(""); setOpen(false); }}>✕</button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-2xl">
          {results.length === 0 && <div className="p-3 text-xs text-muted-foreground">No match</div>}
          {results.map((c) => (
            <button key={c.code} type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => { onChange(c.name, c); setOpen(false); setQuery(""); }}>
              <span aria-hidden className="text-base leading-none">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[0.6rem] text-muted-foreground">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { COUNTRIES };