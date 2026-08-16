import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamCrest } from "@/components/team-crest";
import { FlagIcon } from "@/components/flag";
import { supabase, formatDate, type Coach } from "@/lib/db";
import { useTx } from "@/lib/auto-translate";
import { CalendarDays, Users, MapPin, Trophy, FileSignature, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/coaches/$id")({
  head: () => ({
    meta: [
      { title: "Coach profile — MansourAlmailScores" },
      { name: "description", content: "Coach profile with club, nationality and career details on MansourAlmailScores." },
      { property: "og:title", content: "Coach profile — MansourAlmailScores" },
      { property: "og:description", content: "Coach profile with club, nationality and career details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const tx = useTx();
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["coach", id],
    queryFn: async () => (await supabase.from("coaches").select("*, team:team_id(id,name,logo_url)").eq("id", id).maybeSingle()).data as
      | (Coach & { team: { id: string; name: string; logo_url: string | null } | null })
      | null,
  });

  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title={tx("Coach not found")} /></AppShell>;
  const coach = q.data;

  return (
    <AppShell>
      <BackButton />
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <PlayerAvatar src={coach.photo_url} name={coach.name} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black">{tx(coach.name)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{tx("Coach")}</span>
              {coach.nationality && <span className="flex items-center gap-1"><FlagIcon value={coach.nationality_code ?? coach.nationality} />{tx(coach.nationality)}</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {coach.team && (
            <Link to="/teams/$id" params={{ id: coach.team.id }} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:border-primary">
              <TeamCrest name={coach.team.name} logo={coach.team.logo_url} className="h-8 w-8" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Club")}</div><div className="font-semibold">{tx(coach.team.name)}</div></div>
            </Link>
          )}
          {coach.dob && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Date of birth")}</div><div className="font-semibold">{formatDate(coach.dob)}</div></div>
            </div>
          )}
          {coach.birth_place && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Birth place")}</div><div className="font-semibold">{tx(coach.birth_place)}</div></div>
            </div>
          )}
          {coach.appointed_on && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Appointed")}</div><div className="font-semibold">{formatDate(coach.appointed_on)}</div></div>
            </div>
          )}
          {coach.contract_until && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <FileSignature className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Contract until")}</div><div className="font-semibold">{formatDate(coach.contract_until)}</div></div>
            </div>
          )}
          {coach.preferred_formation && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Preferred formation")}</div><div className="font-semibold">{coach.preferred_formation}</div></div>
            </div>
          )}
          {coach.trophies ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Trophies")}</div><div className="font-semibold">{coach.trophies}</div></div>
            </div>
          ) : null}
          {!coach.team && !coach.dob && !coach.bio && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm text-muted-foreground"><Users className="h-4 w-4" />{tx("No further details yet.")}</div>
          )}
        </div>
        {coach.bio && <p className="mt-4 rounded-2xl border border-border p-4 text-sm leading-relaxed">{tx(coach.bio)}</p>}
      </div>
    </AppShell>
  );
}