import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { unlockAdmin } from "@/lib/admin.functions";
import { Loader2, ShieldCheck } from "lucide-react";

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
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Full editor coming online — competitions, teams, matches, standings, and news modules.</p>
      <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        You're unlocked as an admin. The full admin CRUD UI will render here in the next update. Data model, storage, real-time sync and permissions are all live already.
      </div>
    </AppShell>
  );
}