import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { unlockAdmin } from "@/lib/admin.functions";
import { Loader2, ShieldCheck, ArrowLeft, Bot, CalendarDays, Newspaper, Radio, Repeat2, Trophy, Landmark, Shield, Users, LogOut, Flag } from "lucide-react";
import type { Competition } from "@/lib/db";
import { CompetitionsPanel } from "@/components/admin/competitions-panel";
import { TeamsPanel } from "@/components/admin/teams-panel";
import { PlayersPanel } from "@/components/admin/players-panel";
import { MatchesPanel } from "@/components/admin/matches-panel";
import { StandingsPanel } from "@/components/admin/standings-panel";
import { NewsPanel } from "@/components/admin/news-panel";
import { AlmailAiPanel, ChannelsPanel, TransfersAdminPanel, VenuesPanel } from "@/components/admin/content-panels";
import { CompetitionAwardsManager, MediaManager } from "@/components/admin/media-manager";
import { ChatReportsPanel } from "@/components/admin/chat-reports-panel";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"competitions" | "teams" | "players" | "news" | "ai" | "venues" | "channels" | "transfers" | "reports">("competitions");
  const [openComp, setOpenComp] = useState<Competition | null>(null);
  const [compTab, setCompTab] = useState<"overview" | "teams" | "matches" | "standings" | "awards" | "media">("overview");
  const unlock = useServerFn(unlockAdmin);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await unlock({ data: { password } });
      if (res.ok) setIsAdmin(true);
       else setError(res.rateLimited ? "Too many attempts. Try again in 15 minutes." : t("admin.unlock.wrong"));
    } finally { setBusy(false); }
  };

  if (loading || isAdmin === null) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" /> {t("admin.unlock.title")}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.unlock.desc")}</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t("admin.unlock.password")}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button disabled={busy} className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.unlock.submit")}
            </button>
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {openComp ? (
        <div>
          <button onClick={() => setOpenComp(null)} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All competitions
          </button>
          <div className="flex items-center gap-3">
            {openComp.logo_url && <img src={openComp.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain" />}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{openComp.name}</h1>
              <p className="text-xs text-muted-foreground">{[openComp.country, openComp.season, openComp.format].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="mt-5 flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-xs">
            {(["overview", "teams", "matches", "standings", "awards", "media"] as const).map((k) => (
              <button key={k} onClick={() => setCompTab(k)} className={`rounded-full px-4 py-1.5 font-semibold capitalize ${compTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
          <div className="mt-6">
            {compTab === "overview" && <CompetitionOverview competition={openComp} />}
            {compTab === "teams" && <TeamsPanel competitionId={openComp.id} />}
            {compTab === "matches" && <MatchesPanel competitionId={openComp.id} />}
            {compTab === "standings" && <StandingsPanel competitionId={openComp.id} />}
            {compTab === "awards" && <CompetitionAwardsManager competitionId={openComp.id} />}
            {compTab === "media" && <MediaManager ownerType="competition" ownerId={openComp.id} />}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin control centre</h1>
              <p className="mt-1 text-sm text-muted-foreground">Competitions, matches, players, news, AI and reusable libraries in one place.</p>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {([
              ["competitions", Trophy], ["teams", Shield], ["players", Users], ["news", Newspaper], ["ai", Bot], ["venues", Landmark], ["channels", Radio], ["transfers", Repeat2], ["reports", Flag],
            ] as const).map(([k, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex min-h-20 flex-col items-start justify-between rounded-lg border p-3 text-left font-semibold capitalize ${tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}><Icon className="h-4 w-4" />{k === "ai" ? "Almail AI" : k}</button>
            ))}
          </div>
          <div className="mt-6">
            {tab === "competitions" && <CompetitionsPanel onOpen={setOpenComp} />}
            {tab === "teams" && (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">Every saved team in one place — create and edit clubs, squads and coaches without opening a competition.</p>
                <TeamsPanel competitionId={null} />
              </div>
            )}
            {tab === "players" && <PlayersPanel />}
            {tab === "news" && <NewsPanel />}
             {tab === "ai" && <AlmailAiPanel onNews={() => setTab("news")} onCompetitions={() => setTab("competitions")} onVenues={() => setTab("venues")} />}
            {tab === "venues" && <VenuesPanel />}
            {tab === "channels" && <ChannelsPanel />}
            {tab === "transfers" && <TransfersAdminPanel />}
            {tab === "reports" && <ChatReportsPanel />}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CompetitionOverview({ competition }: { competition: Competition }) {
  const items = [
    ["Sport", competition.sport], ["Format", competition.format], ["Current season", competition.season],
    ["Starts", competition.starts_on || "—"], ["Ends", competition.ends_on || "—"],
  ];
  return <div><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h2 className="font-bold">Competition setup</h2></div><div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="bg-card p-4"><div className="text-[0.65rem] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || "—"}</div></div>)}</div><p className="mt-4 text-sm text-muted-foreground">Use Teams for the saved club library, Matches for schedules and match centres, and Standings for groups and qualification labels.</p></div>;
}