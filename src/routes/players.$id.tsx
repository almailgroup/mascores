import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, formatHeight, formatDob, type Player, type Team, type Match, type Transfer } from "@/lib/db";
import { FavoriteButton } from "@/hooks/use-favorites";
import { FlagIcon } from "@/components/flag";
import { useI18n } from "@/lib/i18n";
import { PlayerAvatar } from "@/components/player-avatar";
import { LinkedNews } from "@/components/linked-news";
import { formatMoney, useCurrency } from "@/lib/currency";
import { ArrowRight } from "lucide-react";
import { useTx } from "@/lib/auto-translate";
import { useDates, useNum } from "@/lib/auto-translate";

export const Route = createFileRoute("/players/$id")({
  head: () => ({
    meta: [
      { title: "Player — MansourAlmailScores" },
      { name: "description", content: "Player profile: details, transfer history, matches and media." },
      { property: "og:title", content: "Player — MansourAlmailScores" },
      { property: "og:description", content: "Player profile: details, transfer history, matches and media." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerPage,
});

type Tab = "details" | "matches" | "media" | "news";

function age(dob: string | null | undefined) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function PlayerPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { t: tr } = useI18n();
  const { currency } = useCurrency();
  const [tab, setTab] = useState<Tab>("details");

  const q = useQuery({ queryKey: ["player", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*, team:team_id(id,name,logo_url)").eq("id", id).maybeSingle();
    return data as (Player & { team: Team | null }) | null;
  }});
  const transfers = useQuery({ queryKey: ["player-transfers", id], queryFn: async () => {
    const { data } = await supabase.from("transfers").select("*").eq("person_id", id).eq("person_type", "player")
      .order("moved_on", { ascending: false, nullsFirst: false });
    return (data ?? []) as Transfer[];
  }});
  const matches = useQuery({ enabled: !!q.data, queryKey: ["player-matches", id], queryFn: async () => {
    const { data: lineups } = await supabase.from("match_lineups").select("match_id").eq("player_id", id);
    const ids = (lineups ?? []).map((l) => l.match_id);
    if (!ids.length) return [];
    const { data } = await supabase.from("matches")
      .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)")
      .in("id", ids).order("kickoff_at", { ascending: false });
    return (data ?? []) as unknown as (Match & { home: Team | null; away: Team | null })[];
  }});

  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title={tx("Player not found")} /></AppShell>;
  const p = q.data;
  const nat = p.nationality_code ?? p.nationality;

  return (
    <AppShell>
      <div className="mb-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6">
        <div className="flex items-center gap-5">
          <PlayerAvatar src={p.photo_url} name={p.name} size="lg" className="border-2 border-primary/30" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-black tracking-tight">{tx(p.name)}</h1>
            {p.team && (
              <Link to="/teams/$id" params={{ id: p.team.id }} className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                <TeamCrest name={p.team.name} logo={p.team.logo_url} className="h-5 w-5" />
                {tx(p.team.name)}
              </Link>
            )}
          </div>
          <FavoriteButton kind="player" id={p.id} size="md" />
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-xs">
        {(["details", "matches", "media", "news"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-5 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tr(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
             <Stat label={tx("Nationality")} value={tx(p.nationality) ?? "—"} icon={<FlagIcon value={nat} size="md" />} />
             <Stat label={tx("Date of birth")} value={p.dob ? num(`${dates.dob(p.dob)}${age(p.dob) != null ? ` (${age(p.dob)})` : ""}`) : "—"} />
             <Stat label={tx("Height")} value={tx(num(formatHeight(p.height_cm, "cm")))} />
             <Stat label={tx("Position")} value={tx(p.position) ?? "—"} />
             <Stat label={tx("Shirt")} value={p.shirt_number != null ? num(`#${p.shirt_number}`) : "—"} />
             <Stat label={tx("Market value")} value={tx(num(formatMoney(p.market_value, currency)))} />
          </div>

           <h2 className="mb-3 mt-8 text-sm font-bold uppercase text-muted-foreground">{tx("Transfer history")}</h2>
          {transfers.data && transfers.data.length > 0 ? (
            <div className="grid gap-2">
              {transfers.data.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                  <span className="flex-1 truncate">{tx(r.from_club) ?? "—"}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">{tx(r.to_club) ?? "—"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.fee ?? r.transfer_type ?? ""}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.moved_on ? num(dates.date(r.moved_on)) : ""}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title={tx("No transfers recorded")} />}
        </>
      )}

      {tab === "matches" && (
        matches.data && matches.data.length > 0 ? (
          <div className="grid gap-2">
            {matches.data.map((m) => (
              <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="grid items-center gap-2 rounded-2xl border border-border bg-card p-3 hover:border-primary/50" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <div className="truncate text-right text-sm font-semibold">{tx(m.home?.name) ?? "TBD"}</div>
                <div className="text-center text-sm font-bold tabular-nums">{m.home_score != null ? `${m.home_score} – ${m.away_score}` : num(dates.kickoff(m.kickoff_at))}</div>
                <div className="truncate text-sm font-semibold">{tx(m.away?.name) ?? "TBD"}</div>
              </Link>
            ))}
          </div>
        ) : <EmptyState title={tx("No matches yet")} />
      )}

      {tab === "media" && (
        (p.media_urls?.length ?? 0) > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {p.media_urls.map((u) => <img key={u} src={u} alt="" className="h-48 w-full rounded-2xl border border-border object-cover" />)}
          </div>
        ) : <EmptyState title={tx("No media yet")} />
      )}

      {tab === "news" && <LinkedNews kind="player" id={p.id} />}
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 truncate text-sm font-bold">{icon}{value}</div>
    </div>
  );
}