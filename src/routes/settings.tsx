import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { VoiceReplays } from "@/components/voice-replays";
import { AppShell } from "@/components/app-shell";
import { uploadMedia } from "@/components/admin/upload";
import { CURRENCIES, useCurrency } from "@/lib/currency";
import { useHeightUnit } from "@/lib/units";
import { deleteMyAccount } from "@/lib/account.functions";
import { useServerFn } from "@tanstack/react-start";
import { Save, LogOut, Loader2, LogIn, Camera, Trash2, BellRing, Volume2 } from "lucide-react";
import { ImageCropper } from "@/components/image-cropper";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ALERT_EVENTS, ALERT_SOUNDS, playAlertSound, soundFor, type AlertSoundId, type AlertSoundMap } from "@/lib/alert-sounds";


export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const removeAccount = useServerFn(deleteMyAccount);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const { heightUnit, setHeightUnit } = useHeightUnit();
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [alertPrefs, setAlertPrefs] = useState<{ goals: boolean; cards: boolean; kickoff: boolean; final: boolean; voice: boolean; sound: string; sounds: AlertSoundMap }>({ goals: true, cards: true, kickoff: true, final: true, voice: true, sound: "stadium", sounds: {} });

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("display_name,language,avatar_url,height_unit,username,is_public,notification_preferences").eq("id", user.id).maybeSingle();
      setDisplayName(prof?.display_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? null);
      setUsername(prof?.username ?? "");
      setIsPublic(prof?.is_public ?? true);
      if (prof?.notification_preferences && typeof prof.notification_preferences === "object" && !Array.isArray(prof.notification_preferences)) setAlertPrefs((prev) => ({ ...prev, ...(prof.notification_preferences as typeof prev) }));
      if (prof?.height_unit === "ft" || prof?.height_unit === "cm") setHeightUnit(prof.height_unit);
      if (prof?.language && (prof.language === "en" || prof.language === "ar")) setLang(prof.language as Lang);
    })();
  }, [user, authLoading, setLang]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const clean = username.trim().replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 20);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName, language: lang, theme, avatar_url: avatarUrl, height_unit: heightUnit,
       username: clean || null, is_public: isPublic, notification_preferences: alertPrefs,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { setNotice("That username is already taken."); setTimeout(() => setNotice(null), 2500); return; }
    setUsername(clean);
    setNotice(t("settings.saved"));
    setTimeout(() => setNotice(null), 1500);
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    const url = await uploadMedia("avatars", file);
    setUploading(false);
    if (!url) return;
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      {user && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 text-sm font-semibold">{t("settings.profile")}</div>
        {user ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xl font-bold">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (displayName || user.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setAvatarFile(file); e.target.value = ""; }} />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t("settings.displayName")}</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">People can find you by this name. Letters, numbers, dots and underscores.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Public profile — others can find and follow me
              </label>
              {username && (
                <Link to="/u/$username" params={{ username }} className="inline-block text-xs font-semibold text-primary">
                  View my profile
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("settings.signInHint")}</p>
            <Link to="/auth" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              <LogIn className="h-4 w-4" /> {t("nav.signIn")}
            </Link>
          </div>
        )}
      </section>

      {user && <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-primary" /> {t("settings.notifications")}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([['goals','Goals and penalties'],['cards','Cards'],['kickoff','Kick-off and reminders'],['final','Full-time results'],['voice','Followed voice hosts']] as const).map(([key,label]) => <label key={key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={alertPrefs[key]} onChange={(event) => setAlertPrefs({ ...alertPrefs, [key]: event.target.checked })} /></label>)}
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-primary" /> Alert sounds</div>
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Each moment can have its own sound. Tap the play button to hear it.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ALERT_EVENTS.map((event) => {
              const value = soundFor(alertPrefs.sounds, event.key);
              return (
                <div key={event.key} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{event.label}</span>
                  <select className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value as AlertSoundId;
                      setAlertPrefs({ ...alertPrefs, sounds: { ...alertPrefs.sounds, [event.key]: next } });
                      playAlertSound(next);
                    }}>
                    {ALERT_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
                  </select>
                  <button type="button" aria-label={`Play ${event.label} sound`} onClick={() => playAlertSound(value)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-primary">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-2 text-[0.7rem] text-muted-foreground">Alerts work while the app is open. System delivery depends on your phone and browser permissions.</p>
      </section>}
      {avatarFile && <ImageCropper file={avatarFile} aspect={1} onCancel={() => setAvatarFile(null)} onDone={async (file) => { await pickAvatar(file); setAvatarFile(null); }} />}

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
          <div className="grid grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((th) => (
              <button key={th} type="button" onClick={() => setTheme(th)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${theme === th ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {t(`settings.theme.${th}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 text-sm font-semibold">{t("settings.heightUnit")}</div>
        <div className="grid max-w-xs grid-cols-2 gap-2">
          {(["cm", "ft"] as const).map((u) => (
            <button key={u} type="button" onClick={() => setHeightUnit(u)}
              className={`rounded-xl border px-3 py-2 text-sm ${heightUnit === u ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
              {u === "cm" ? "cm" : "ft / in"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="mb-1 text-sm font-semibold">{t("settings.currency")}</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("settings.currencyHint")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {CURRENCIES.map((c) => (
            <button key={c} type="button" onClick={() => setCurrency(c)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${currency === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {notice && <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</div>}

      {user && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("settings.save")}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent">
            <LogOut className="h-4 w-4" /> {t("settings.signOut")}
          </button>
        </div>
      )}

      {user && (
        <section className="mt-10">
          <h2 className="text-sm font-bold">My voice replays</h2>
          <p className="mb-3 text-xs text-muted-foreground">Voice chats you recorded. Play them again or delete them.</p>
          <VoiceReplays mine />
        </section>
      )}

      <FeedbackBox />

      {user && <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-destructive">{t("settings.deleteAccount")}</div>
            <p className="text-[0.65rem] text-muted-foreground">{t("settings.deleteAccountHint")}</p>
          </div>
          <button disabled={deleting} onClick={() => setConfirmDelete(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-3 text-[0.7rem] font-semibold text-destructive disabled:opacity-60">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} {t("settings.deleteAccount")}
          </button>
        </div>
        <ConfirmDelete
          open={confirmDelete}
          title={t("settings.deleteAccount")}
          description={t("settings.deleteAccountConfirm")}
          confirmWord="DELETE"
          actionLabel={t("settings.deleteAccount")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await removeAccount({});
              await supabase.auth.signOut();
              navigate({ to: "/" });
            } finally { setDeleting(false); setConfirmDelete(false); }
          }}
        />
      </section>}
    </AppShell>
  );
}
/** Sends the owner feedback about the app straight to his inbox. */
function FeedbackBox() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<{ id: string; message: string; admin_reply: string | null; created_at: string }[]>([]);
  const owner = "mansouralmailscores@gmail.com";
  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from("app_feedback").select("id,message,admin_reply,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setHistory(data ?? []);
  };
  useEffect(() => { void loadHistory(); }, [user?.id]);
  return (
    <section className="mt-10 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-sm font-bold">Send feedback</h2>
      <p className="mb-3 text-xs text-muted-foreground">Tell the owner what you like, what is missing, or what went wrong.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Your feedback…"
        className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={!message.trim() || sent}
          onClick={async () => {
            const { data } = await supabase.auth.getUser();
            await supabase.from("app_feedback").insert({ message, user_id: data.user?.id ?? null, email: data.user?.email ?? null } as never);
            setSent(true); setMessage(""); void loadHistory();
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {sent ? "Thank you!" : "Send feedback"}
        </button>
        <a href={`mailto:${owner}?subject=${encodeURIComponent("Mansour Almail Scores feedback")}&body=${encodeURIComponent(message)}`}
          className="text-[0.7rem] font-semibold text-primary">Email instead</a>
      </div>
      {history.length > 0 && <div className="mt-5 space-y-2 border-t border-border pt-4">
        <h3 className="text-xs font-bold">Your feedback and replies</h3>
        {history.map((item) => <div key={item.id} className="rounded-xl bg-muted/50 p-3 text-xs"><p>{item.message}</p>{item.admin_reply && <div className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-2"><div className="mb-1 font-bold text-primary">Owner reply</div>{item.admin_reply}</div>}</div>)}
      </div>}
    </section>
  );
}
