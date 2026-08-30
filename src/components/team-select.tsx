import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";

export type TeamSelectOption = { id: string; name: string; logo_url?: string | null; country?: string | null };

export function TeamSelect({ teams, value, onChange, placeholder = "Search clubs…", allowFreeAgent = true }: {
  teams: TeamSelectOption[];
  value: string | null | undefined;
  onChange: (id: string | null, team: TeamSelectOption | null) => void;
  placeholder?: string;
  allowFreeAgent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = teams.find((team) => team.id === value) ?? null;
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return teams.filter((team) => !needle || `${team.name} ${team.country ?? ""}`.toLocaleLowerCase().includes(needle)).slice(0, 80);
  }, [query, teams]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={root} className="relative">
      <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
        {selected ? <TeamCrest name={selected.name} logo={selected.logo_url} className="h-6 w-6 shrink-0" /> : <Search className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" value={open ? query : (selected?.name ?? "")} placeholder={placeholder}
          onFocus={() => { setQuery(""); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} />
        {value && <button type="button" aria-label="Clear club" className="text-muted-foreground hover:text-foreground" onClick={() => { onChange(null, null); setQuery(""); }}><X className="h-4 w-4" /></button>}
      </div>
      {open && <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
        {allowFreeAgent && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent" onMouseDown={(event) => { event.preventDefault(); onChange(null, null); setOpen(false); }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">—</span><span>Free agent</span>
        </button>}
        {results.map((team) => <button key={team.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent" onMouseDown={(event) => { event.preventDefault(); onChange(team.id, team); setOpen(false); setQuery(""); }}>
          <TeamCrest name={team.name} logo={team.logo_url} className="h-7 w-7 shrink-0" />
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{team.name}</span>{team.country && <span className="block truncate text-xs text-muted-foreground">{team.country}</span>}</span>
        </button>)}
        {results.length === 0 && <p className="p-3 text-xs text-muted-foreground">No matching club</p>}
      </div>}
    </div>
  );
}