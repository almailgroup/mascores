import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { unlockAdmin } from "@/lib/admin.functions";
import { Loader2, ShieldCheck, ArrowLeft, Bot, CalendarDays, Newspaper, Radio, Repeat2, Trophy, Landmark, Shield, Users, LogOut, Flag, Globe, Ticket, UserCog, Mic } from "lucide-react";
import type { Competition } from "@/lib/db";
import { CompetitionsPanel } from "@/components/admin/competitions-panel";
import { TeamsPanel } from "@/components/admin/teams-panel";
import { FifaRankingsPanel } from "@/components/admin/fifa-rankings-panel";
import { PlayersPanel } from "@/components/admin/players-panel";
import { MatchesPanel } from "@/components/admin/matches-panel";
import { StandingsPanel } from "@/components/admin/standings-panel";
import { NewsPanel } from "@/components/admin/news-panel";
import { AlmailAiPanel, ChannelsPanel, TransfersAdminPanel, VenuesPanel } from "@/components/admin/content-panels";
import { CompetitionAwardsManager, MediaManager } from "@/components/admin/media-manager";
import { ChatReportsPanel } from "@/components/admin/chat-reports-panel";
import { TicketsPanel } from "@/components/admin/tickets-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { VoicePanel } from "@/components/admin/voice-panel";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SeasonMenu } from "@/components/season-menu";

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
  const [tab, setTab] = useState<"competitions" | "teams" | "countries" | "players" | "news" | "ai" | "venues" | "channels" | "transfers" | "reports" | "tickets" | "users" | "voice">("competitions");
  const [openComp, setOpenComp] = useState<Competition | null>(null);
  const [adminSeason, setAdminSeason] = useState<string | null>(null);
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
    <AppShell bare={!!openComp}>
      {openComp ? (
        <div>
          {/* Back arrow and title keep their own row so the season button can
              never sit on top of them on narrow screens. */}
          <div className="mb-3">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={() => setOpenComp(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-accent" aria-label="All competitions">
                <ArrowLeft className="h-4 w-4" />
              </button>
              {openComp.logo_url && <img src={openComp.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{openComp.name}</span>
            </div>
            <div className="mt-2 flex justify-start ps-10">
              <SeasonPicker competition={openComp} onChange={setOpenComp} season={adminSeason} onSeason={setAdminSeason} />
            </div>
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-xs">
            {(openComp.format === "friendly"
              ? (["overview", "teams", "matches", "media"] as const)
              : (["overview", "teams", "matches", "standings", "awards", "media"] as const)
            ).map((k) => (
              <button key={k} onClick={() => setCompTab(k)} className={`rounded-full px-4 py-1.5 font-semibold capitalize ${compTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
          <div className="mt-6">
            {compTab === "overview" && <CompetitionOverview competition={openComp} />}
            {compTab === "teams" && <TeamsPanel competitionId={openComp.id} season={adminSeason ?? openComp.season ?? null} competition={openComp} />}
            {compTab === "matches" && <MatchesPanel competitionId={openComp.id} season={adminSeason ?? openComp.season ?? null} friendly={openComp.format === "friendly"} />}
            {compTab === "standings" && openComp.format !== "friendly" && <StandingsPanel competitionId={openComp.id} season={adminSeason ?? openComp.season ?? null} />}
            {compTab === "awards" && openComp.format !== "friendly" && <CompetitionAwardsManager competitionId={openComp.id} />}
            {compTab === "media" && <MediaManager ownerType="competition" ownerId={openComp.id} />}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Admin control centre</h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Pick a section below. Everything is grouped, so nothing needs sideways scrolling.</p>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-accent sm:px-4 sm:text-sm"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {([
              ["competitions", Trophy], ["teams", Shield], ["countries", Globe], ["players", Users], ["news", Newspaper], ["ai", Bot], ["venues", Landmark], ["channels", Radio], ["transfers", Repeat2], ["tickets", Ticket], ["reports", Flag], ["users", UserCog], ["voice", Mic],
            ] as const).map(([k, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex min-h-20 flex-col items-start justify-between rounded-lg border p-3 text-left font-semibold capitalize ${tab === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}><Icon className="h-4 w-4" />{k === "ai" ? "Almail AI" : k}</button>
            ))}
          </div>
          <div className="mt-6">
            {tab === "competitions" && <CompetitionsPanel onOpen={setOpenComp} />}
            {tab === "teams" && (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">Every saved club in one place — create and edit clubs, squads and coaches without opening a competition.</p>
                <TeamsPanel competitionId={null} lockKind="clubs" />
              </div>
            )}
            {tab === "countries" && (
              <div className="space-y-10">
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">National teams live here, separate from clubs — squads are call-ups, so players keep their club.</p>
                  <TeamsPanel competitionId={null} lockKind="national" />
                </div>
                <FifaRankingsPanel />
              </div>
            )}
            {tab === "players" && <PlayersPanel />}
            {tab === "news" && <NewsPanel />}
             {tab === "ai" && <AlmailAiPanel onNews={() => setTab("news")} onCompetitions={() => setTab("competitions")} onVenues={() => setTab("venues")} />}
            {tab === "venues" && <VenuesPanel />}
            {tab === "channels" && <ChannelsPanel />}
            {tab === "transfers" && <TransfersAdminPanel />}
            {tab === "tickets" && <TicketsPanel />}
            {tab === "reports" && <ChatReportsPanel />}
            {tab === "users" && <UsersPanel />}
           {tab === "voice" && <VoicePanel />}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CompetitionOverview({ competition }: { competition: Competition }) {
  return <CompetitionSetup competition={competition} />;
}

/** Season switcher with inline creation of a new or past season. */
function SeasonPicker({ competition, onChange, season, onSeason }: { competition: Competition; onChange: (c: Competition) => void; season: string | null; onSeason: (s: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteSeason, setDeleteSeason] = useState<string | null>(null);
  const seasons = competition.seasons?.length ? competition.seasons : (competition.season ? [competition.season] : []);
  const current = season ?? competition.season ?? seasons[0] ?? "";

  const create = async (makeCurrent: boolean) => {
    const next = value.trim();
    if (!next || busy) return;
    setBusy(true);
    const list = seasons.includes(next) ? seasons : [...seasons, next];
    const payload = makeCurrent ? { seasons: list, season: next } : { seasons: list };
    await supabase.from("competitions").update(payload).eq("id", competition.id);
    onChange({ ...competition, ...payload } as Competition);
    onSeason(next);
    setBusy(false);
    setValue("");
    setCreating(false);
  };

  const removeSeason = async (target: string) => {
    const list = seasons.filter((item) => item !== target);
    await supabase.from("matches").delete().eq("competition_id", competition.id).eq("season", target);
    await supabase.from("standings_rows").delete().eq("competition_id", competition.id).eq("season", target);
    await supabase.from("competition_teams").delete().eq("competition_id", competition.id).eq("season", target);
    const payload = { seasons: list, season: competition.season === target ? (list[0] ?? null) : competition.season };
    await supabase.from("competitions").update(payload as never).eq("id", competition.id);
    onChange({ ...competition, ...payload } as Competition);
    onSeason(list[0] ?? "");
    setDeleteSeason(null);
  };

  return (
    <div className="relative shrink-0">
      <SeasonMenu seasons={seasons} value={current} onChange={onSeason} footer={<>
        <button type="button" className="block w-full rounded-lg px-3 py-2 text-start text-xs font-semibold hover:bg-accent" onClick={() => setCreating(true)}>Create season…</button>
        {current && <button type="button" className="block w-full rounded-lg px-3 py-2 text-start text-xs font-semibold text-destructive hover:bg-accent" onClick={() => setDeleteSeason(current)}>Delete {current}…</button>}
      </>} />
      <ConfirmDelete
        open={!!deleteSeason}
        title={`Delete season ${deleteSeason ?? ""}`}
        description={`This permanently deletes every match, standings row and team link saved to ${deleteSeason} in ${competition.name}. Other seasons are not affected. This cannot be undone.`}
        confirmWord={deleteSeason ?? "DELETE"}
        actionLabel="Delete season"
        onCancel={() => setDeleteSeason(null)}
        onConfirm={() => deleteSeason ? removeSeason(deleteSeason) : undefined}
      />
      {creating && (
        <div className="absolute end-0 z-40 mt-2 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="text-xs font-semibold">New or past season</div>
          <input autoFocus className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm" placeholder="26/27" value={value} onChange={(e) => setValue(e.target.value)} />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">Teams, matches and standings you add while this season is selected are saved to it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60" onClick={() => create(true)}>Create current</button>
            <button disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => create(false)}>Add past season</button>
            <button className="rounded-full px-2 py-1.5 text-xs text-muted-foreground" onClick={() => { setCreating(false); setValue(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitionSetup({ competition }: { competition: Competition }) {
  const items = [
    ["Sport", competition.sport], ["Format", competition.format], ["Current season", competition.season],
    ["Starts", competition.starts_on || "—"], ["Ends", competition.ends_on || "—"],
  ];
  return <div><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h2 className="font-bold">Competition setup</h2></div><div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="bg-card p-4"><div className="text-[0.65rem] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || "—"}</div></div>)}</div><p className="mt-4 text-sm text-muted-foreground">Use Teams for the saved club library, Matches for schedules and match centres, and Standings for groups and qualification labels.</p></div>;
}