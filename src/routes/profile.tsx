import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Camera, Loader2, Save, LogOut, Bell, Globe, Palette } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — MansourAlmailScores" },
      { name: "description", content: "Manage your profile, favorites, and notification preferences on MansourAlmailScores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type NotificationPrefs = {
  goals?: boolean;
  match_start?: boolean;
  match_end?: boolean;
  favorite_news?: boolean;
};

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSigned, setAvatarSigned] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("system");
  const [notifs, setNotifs] = useState<NotificationPrefs>({
    goals: true,
    match_start: true,
    match_end: false,
    favorite_news: true,
  });
  const [joined, setJoined] = useState<string>("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        setError(error.message);
      } else if (data) {
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        setLanguage(data.language ?? "en");
        setTheme(data.theme ?? "system");
        const np = (data.notification_preferences ?? {}) as NotificationPrefs;
        setNotifs({
          goals: np.goals ?? true,
          match_start: np.match_start ?? true,
          match_end: np.match_end ?? false,
          favorite_news: np.favorite_news ?? true,
        });
        setJoined(new Date(data.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" }));
        if (data.avatar_url && !data.avatar_url.startsWith("http")) {
          const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(data.avatar_url, 3600);
          setAvatarSigned(signed?.signedUrl ?? null);
        } else {
          setAvatarSigned(data.avatar_url);
        }
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (profErr) throw profErr;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      setAvatarUrl(path);
      setAvatarSigned(signed?.signedUrl ?? null);
      setNotice("Avatar updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        language,
        theme,
        notification_preferences: notifs as never,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) setError(error.message);
    else setNotice("Saved");
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex">
          <BrandLogo variant="horizontal" className="h-9 w-auto rounded-md" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Member since {joined}</p>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-3xl font-bold text-muted-foreground">
                {avatarSigned ? (
                  <img src={avatarSigned} alt="" className="h-full w-full object-cover" />
                ) : (
                  (displayName || user?.email || "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 disabled:opacity-60"
                aria-label="Upload avatar"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatar(f);
                }}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-primary" /> Language
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="pt">Português</option>
            </select>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Palette className="h-4 w-4 text-primary" /> Theme preference
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${
                    theme === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </div>
          <div className="space-y-3">
            {[
              { key: "goals" as const, label: "Goals from favorite teams" },
              { key: "match_start" as const, label: "Match kick-off reminders" },
              { key: "match_end" as const, label: "Full-time results" },
              { key: "favorite_news" as const, label: "Breaking news about favorites" },
            ].map((row) => (
              <label key={row.key} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <input
                  type="checkbox"
                  checked={!!notifs[row.key]}
                  onChange={(e) => setNotifs({ ...notifs, [row.key]: e.target.checked })}
                  className="h-5 w-9 appearance-none rounded-full bg-muted checked:bg-primary transition-colors relative before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-background before:transition-transform checked:before:translate-x-4"
                />
              </label>
            ))}
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-6 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {notice}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      </main>
    </div>
  );
}