import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { AppShell, BackButton } from "@/components/app-shell";
import { uploadMedia } from "@/components/admin/upload";
import { CURRENCIES, useCurrency } from "@/lib/currency";
import { useHeightUnit } from "@/lib/units";
import { deleteMyAccount } from "@/lib/account.functions";
import { useServerFn } from "@tanstack/react-start";
import { Save, LogOut, Loader2, LogIn, Camera, Trash2, BellRing } from "lucide-react";
import { ImageCropper } from "@/components/image-cropper";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { AlertSoundMap } from "@/lib/alert-sounds";
import { Button } from '@/components/ui/button';
import { useQuery } from "@tanstack/react-query";
import { AccountPrivacy } from "@/components/account-privacy";
import { BlockedAccounts } from "@/components/blocked-accounts";
import { SocialActivityButton } from "@/components/social-activity";
import { NotificationSoundPreview } from "@/components/notification-sound-preview";
import { canPreviewNotificationSounds } from "@/lib/sound-preview-access";


export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MA Scores" }, { name: "robots", content: "noindex" }, { name: "description", content: "Manage your MA Scores account and preferences." }, { property: "og:title", content: "Settings — MA Scores" }, { property: "og:description", content: "Manage your MA Scores account and preferences." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const owner = useQuery({ queryKey: ["settings-owner", user?.id], enabled: !!user, queryFn: async () => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("is_main_admin", { _uid: user.id });
    return !error && data === true;
  }});
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
  const [hideFollows, setHideFollows] = useState(false);
  const { heightUnit, setHeightUnit } = useHeightUnit();
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [alertPrefs, setAlertPrefs] = useState<{ goals: boolean; cards: boolean; kickoff: boolean; final: boolean; voice: boolean; social: boolean; social_follow: boolean; social_request: boolean; social_like: boolean; social_comment: boolean; social_repost: boolean; sound: string; sounds: AlertSoundMap }>({ goals: true, cards: true, kickoff: true, final: true, voice: true, social: true, social_follow: true, social_request: true, social_like: true, social_comment: true, social_repost: true, sound: "stadium", sounds: {} });

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("display_name,language,avatar_url,height_unit,username,is_public,hide_follows,notification_preferences").eq("id", user.id).maybeSingle();
      setDisplayName(prof?.display_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? null);
      setUsername(prof?.username ?? "");
      setIsPublic(prof?.is_public ?? true);
      setHideFollows(!!prof?.hide_follows);
      if (prof?.notification_preferences && typeof prof.notification_preferences === "object" && !Array.isArray(prof.notification_preferences)) setAlertPrefs((prev) => ({ ...prev, ...(prof.notification_preferences as typeof prev) }));
      if (prof?.height_unit === "ft" || prof?.height_unit === "cm") setHeightUnit(prof.height_unit);
    })();
  }, [user, authLoading]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const clean = username.trim().replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 20);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName, avatar_url: avatarUrl, username: clean || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      const until = error.message.split(":").slice(1).join(":");
      const when = until ? new Date(until).toLocaleString(lang === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }) : "";
      const msg = error.message.startsWith("USERNAME_COOLDOWN")
        ? (lang === "ar" ? `يمكنك تغيير اسم المستخدم مرة كل 10 أيام. التغيير التالي: ${when}` : `You can change your username once every 10 days. Next change: ${when}`)
        : error.message.startsWith("DISPLAY_COOLDOWN")
        ? (lang === "ar" ? `يمكنك تغيير الاسم الظاهر مرة كل يومين. التغيير التالي: ${when}` : `You can change your display name once every 2 days. Next change: ${when}`)
        : (lang === "ar" ? "اسم المستخدم مستخدم بالفعل." : "That username is already taken.");
      setNotice(msg); setTimeout(() => setNotice(null), 4000); return;
    }
    setUsername(clean);
    setNotice(t("settings.saved"));
    setTimeout(() => setNotice(null), 1500);
  };

  /** Notification switches save at once, so phone alerts follow them without pressing Save. */
  const saveAlertPrefs = async (next: typeof alertPrefs) => {
    setAlertPrefs(next);
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("notification_preferences").eq("id", user.id).maybeSingle();
    const saved = prof?.notification_preferences;
    await supabase.from("profiles").update({
      notification_preferences: { ...(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}), ...next },
    }).eq("id", user.id);
    window.dispatchEvent(new Event("mas:alerts-changed"));
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadMedia("avatars", file, user.id);
      if (!url) throw new Error('Photo upload failed');
      const {error}=await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if(error)throw error;
      setAvatarUrl(url);
    } finally { setUploading(false); }
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <BackButton iconOnly className="mb-3" />
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">{t("settings.title")}</h1>{user && <SocialActivityButton />}</div>
      {owner.data && <Link to="/admin" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">{lang === "ar" ? "إدارة المسابقات وسجل الأبطال" : "Competition settings & title history"}</Link>}
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
              <AccountPrivacy userId={user.id} isPublic={isPublic} onChange={setIsPublic} />
              <label className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{lang === "ar" ? "إخفاء المتابعين والمتابَعين" : "Hide followers and following"}</span>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={hideFollows} onChange={async (e) => {
                  const next = e.target.checked; setHideFollows(next);
                  const { error } = await supabase.from("profiles").update({ hide_follows: next }).eq("id", user.id);
                  if (error) setHideFollows(!next);
                }} />
              </label>
              <BlockedAccounts />
              <p className="text-[0.65rem] text-muted-foreground">{lang === "ar" ? "يمكن تغيير اسم المستخدم مرة كل 10 أيام والاسم الظاهر مرة كل يومين." : "Username can change once every 10 days, display name once every 2 days."}</p>
              {notice && <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</div>}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("settings.save")}
                </button>
                {username && (
                  <Link to="/u/$username" params={{ username }} className="inline-block text-xs font-semibold text-primary">
                    View my profile
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("settings.signInHint")}</p>
            <Button asChild className="rounded-full">
              <Link to="/auth"><LogIn className="h-4 w-4" /> {lang === "ar" ? "تسجيل الدخول / إنشاء حساب" : "Sign in / Log in"}</Link>
            </Button>
          </div>
        )}
      </section>

      {user && <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-primary" /> {t("settings.notifications")}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([['goals','Goals and penalties','الأهداف وركلات الجزاء'],['cards','Cards','البطاقات'],['kickoff','Kick-off and reminders','انطلاق المباراة والتذكيرات'],['final','Full-time results','نتائج نهاية المباراة'],['voice','Voice rooms — someone you follow goes live','غرف صوتية — شخص تتابعه يبدأ بثًا']] as const).map(([key,label,labelAr]) => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span>{lang === "ar" ? labelAr : label}</span><input type="checkbox" checked={alertPrefs[key]} onChange={(event) => void saveAlertPrefs({ ...alertPrefs, [key]: event.target.checked })} /></label>)}
        </div>
        <div className="mt-5 border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">{lang === 'ar' ? 'تنبيهات النشاط' : 'Activity alerts'}</h3>
          {([['social','All social phone alerts','جميع تنبيهات النشاط'],['social_follow','New followers','متابعون جدد'],['social_request','Follow requests','طلبات المتابعة'],['social_like','Recording likes','إعجابات التسجيلات'],['social_comment','Comments','التعليقات'],['social_repost','Reposts','إعادة النشر']] as const).map(([key,en,ar]) => <label key={key} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"><span>{lang === 'ar' ? ar : en}</span><input type="checkbox" role="switch" checked={alertPrefs[key]} onChange={e => void saveAlertPrefs({...alertPrefs,[key]:e.target.checked})} /></label>)}
        </div>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">{lang === "ar" ? "تصل تنبيهات الهاتف حتى لو كان التطبيق مغلقًا، أما التنبيهات داخل التطبيق فتظهر أثناء فتحه." : "Phone alerts arrive even when the app is closed. In-app alerts appear while the app is open."}</p>
      </section>}
      {canPreviewNotificationSounds(user?.email, owner.data === true) && <NotificationSoundPreview />}
      {avatarFile && <ImageCropper file={avatarFile} aspect={1} onCancel={() => setAvatarFile(null)} onDone={async (file) => { await pickAvatar(file); setAvatarFile(null); }} />}

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.language")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "ar"] as const).map((l) => (
              <Button key={l} type="button" variant="ghost" onClick={async () => {
                setLang(l);
                if (user) {
                  const { error } = await supabase.from("profiles").update({ language: l }).eq("id", user.id);
                  if (error) setNotice(l === "ar" ? "تم حفظ اللغة على هذا الجهاز. تعذّر مزامنتها مع حسابك." : "Language saved on this device. Account sync failed.");
                }
              }}
                className={`rounded-xl border px-3 py-2 text-sm ${lang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {l === "en" ? "English" : "العربية"}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.theme")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((th) => (
              <button key={th} type="button" onClick={() => { setTheme(th); if (user) void supabase.from("profiles").update({ theme: th }).eq("id", user.id); }}
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
            <button key={u} type="button" onClick={() => { setHeightUnit(u); if (user) void supabase.from("profiles").update({ height_unit: u }).eq("id", user.id); }}
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

      <FeedbackBox />

      {user && <section className="mt-5 flex flex-wrap items-center gap-4">
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium hover:bg-accent">
            <LogOut className="h-3.5 w-3.5" /> {t("settings.signOut")}
          </button>
          <Button variant="link" size="sm" disabled={deleting} onClick={() => setConfirmDelete(true)}
            className="px-0 text-xs text-destructive">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} {t("settings.deleteAccount")}
          </Button>
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
