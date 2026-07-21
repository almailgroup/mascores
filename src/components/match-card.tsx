import { Link } from "@tanstack/react-router";
import { fixtureStatusLabel, isLive, formatKickoff } from "@/lib/football";

export type Fixture = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null; long?: string }; venue?: { name?: string | null; city?: string | null } };
  league: { id: number; name: string; logo?: string; round?: string; country?: string };
  teams: { home: { id: number; name: string; logo?: string; winner?: boolean | null }; away: { id: number; name: string; logo?: string; winner?: boolean | null } };
  goals: { home: number | null; away: number | null };
};

export function MatchCard({ fixture }: { fixture: Fixture }) {
  const live = isLive(fixture.fixture.status.short);
  const status = fixtureStatusLabel(fixture.fixture.status.short, fixture.fixture.status.elapsed);
  const started = !["NS", "PST", "CANC", "TBD"].includes(fixture.fixture.status.short);
  return (
    <Link
      to="/matches/$id"
      params={{ id: String(fixture.fixture.id) }}
      className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="truncate">{fixture.league.name}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${live ? "bg-primary/15 text-primary" : "bg-muted"}`}>
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          {status}
        </span>
      </div>
      <div className="mt-3 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <TeamRow name={fixture.teams.home.name} logo={fixture.teams.home.logo} align="right" winner={fixture.teams.home.winner} />
        <div className="text-center">
          {started ? (
            <div className="text-2xl font-black tabular-nums">
              {fixture.goals.home ?? 0}
              <span className="mx-1 text-muted-foreground">–</span>
              {fixture.goals.away ?? 0}
            </div>
          ) : (
            <div className="text-xs font-medium text-muted-foreground">{formatKickoff(fixture.fixture.date)}</div>
          )}
        </div>
        <TeamRow name={fixture.teams.away.name} logo={fixture.teams.away.logo} align="left" winner={fixture.teams.away.winner} />
      </div>
    </Link>
  );
}

function TeamRow({ name, logo, align, winner }: { name: string; logo?: string; align: "left" | "right"; winner?: boolean | null }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && logo && <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />}
      <span className={`truncate text-sm font-semibold ${winner === false ? "text-muted-foreground" : ""}`}>{name}</span>
      {align === "right" && logo && <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />}
    </div>
  );
}