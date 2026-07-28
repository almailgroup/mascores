import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { Save, LogOut, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const [{ data: prof }, { data: admin }] = await Promise.all([
        supabase.from("profiles").select("display_name,language").eq("id", user.id).maybeSingle(),
        supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      setDisplayName(prof?.display_name ?? "");
      if (prof?.language && (prof.language === "en" || prof.language === "ar")) setLang(prof.language as Lang);
      setIsAdmin(!!admin);
    })();
  }, [user, authLoading, navigate, setLang]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName, language: lang, theme }).eq("id", user.id);
    setSaving(false);
    setNotice(t("settings.saved"));
    setTimeout(() => setNotice(null), 1500);
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 text-sm font-semibold">{t("settings.profile")}</div>
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t("settings.displayName")}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.language")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "ar"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`rounded-xl border px-3 py-2 text-sm ${lang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.theme")}</div>
          <div className="grid grid-cols-3 gap-2">
            {(["light", "dark", "system"] as const).map((th) => (
              <button key={th} type="button" onClick={() => setTheme(th)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${theme === th ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {t(`settings.theme.${th}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {notice && <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</div>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("settings.save")}
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent">
          <LogOut className="h-4 w-4" /> {t("settings.signOut")}
        </button>
      </div>

      <section className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> {t("settings.admin")}</div>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.adminHint")}</p>
        <Link to="/admin" className="mt-3 inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-accent">
          {isAdmin ? "Open admin" : "Enter admin"}
        </Link>
      </section>
    </AppShell>
  );
}