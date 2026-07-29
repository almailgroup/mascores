import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { unlockAdmin } from "@/lib/admin.functions";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import type { Competition } from "@/lib/db";
import { CompetitionsPanel } from "@/components/admin/competitions-panel";
import { TeamsPanel } from "@/components/admin/teams-panel";
import { MatchesPanel } from "@/components/admin/matches-panel";
import { StandingsPanel } from "@/components/admin/standings-panel";
import { NewsPanel } from "@/components/admin/news-panel";

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
  const [tab, setTab] = useState<"competitions" | "news">("competitions");
  const [openComp, setOpenComp] = useState<Competition | null>(null);
  const [compTab, setCompTab] = useState<"teams" | "matches" | "standings">("teams");
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
      else setError(t("admin.unlock.wrong"));
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
          <div className="mt-5 flex gap-1 rounded-full border border-border bg-card p-1 text-xs w-fit">
            {(["teams", "matches", "standings"] as const).map((k) => (
              <button key={k} onClick={() => setCompTab(k)} className={`rounded-full px-4 py-1.5 font-semibold capitalize ${compTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
          <div className="mt-6">
            {compTab === "teams" && <TeamsPanel competitionId={openComp.id} />}
            {compTab === "matches" && <MatchesPanel competitionId={openComp.id} />}
            {compTab === "standings" && <StandingsPanel competitionId={openComp.id} />}
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <div className="mt-4 flex gap-1 rounded-full border border-border bg-card p-1 text-xs w-fit">
            {(["competitions", "news"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 font-semibold capitalize ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
          <div className="mt-6">
            {tab === "competitions" && <CompetitionsPanel onOpen={setOpenComp} />}
            {tab === "news" && <NewsPanel />}
          </div>
        </div>
      )}
    </AppShell>
  );
}