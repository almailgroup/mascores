import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

type Alert = { id: string; title: string; host: string };

/**
 * Notifies signed-in users when someone they follow opens a voice room.
 * Listens to new public rooms in realtime and filters to followed hosts.
 */
export function LiveVoiceAlert() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (!user) return;
    let following: string[] = [];
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.from("profile_follows").select("following_id").eq("follower_id", user.id);
      if (!cancelled) following = ((data ?? []) as { following_id: string }[]).map((row) => row.following_id);
    })();

    const channel = supabase
      .channel("voice-follow-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_rooms" }, async (payload) => {
        const room = payload.new as { id: string; host_id: string; title: string; status: string; visibility: string };
        if (room.status !== "live" || !following.includes(room.host_id)) return;
        const { data } = await supabase.rpc("voice_host_profiles", { _ids: [room.host_id] });
        const host = ((data ?? []) as { display_name: string | null }[])[0];
        setAlert({ id: room.id, title: room.title, host: host?.display_name ?? (lang === "ar" ? "مضيف" : "Host") });
      })
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [user, lang]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 12000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-50 mx-auto w-[min(24rem,calc(100%-2rem))]">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-background/95 p-3 shadow-xl backdrop-blur">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Radio className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-primary">
            {lang === "ar" ? "بث صوتي مباشر" : "Live voice room"}
          </div>
          <div className="truncate text-sm font-semibold">{alert.host}: {alert.title}</div>
        </div>
        <Link to="/voice/$id" params={{ id: alert.id }} onClick={() => setAlert(null)}
          className="inline-flex h-8 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">
          {lang === "ar" ? "انضم" : "Join"}
        </Link>
        <button onClick={() => setAlert(null)} aria-label="Dismiss" className="text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
