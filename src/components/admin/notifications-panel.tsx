import { useAdminAbility } from "@/lib/admin-ability";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TeamSelect } from "@/components/team-select";
import { Field, inputCls, btnPrimary } from "./ui";
import { sendPush } from "@/lib/push-send";

type Recent = { id: string; kind: string; title_en: string; body_en: string; audience_type: string; created_at: string; sent_at: string | null; result: { sent?: number; failed?: number; devices?: number; recipients?: number; error?: string; errors?: string[] } | null };

/** Owner-only custom phone notification sender. */
export function NotificationsPanel() {
  const { isOwner } = useAdminAbility();
  const qc = useQueryClient();
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [path, setPath] = useState("");
  const [audience, setAudience] = useState<"all" | "team">("all");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teams = useQuery({
    enabled: isOwner,
    queryKey: ["admin", "push-teams"],
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,country").eq("is_temporary", false).order("name")).data ?? [],
  });
  const recent = useQuery({
    enabled: isOwner,
    queryKey: ["admin", "push-recent"],
    queryFn: async () => ((await supabase.rpc("admin_recent_pushes", { _limit: 15 })).data ?? []) as Recent[],
    refetchInterval: 5000,
  });

  const send = async () => {
    if (!titleEn.trim() && !titleAr.trim()) { toast.error("Add a title first"); return; }
    if (audience === "team" && !teamId) { toast.error("Pick a club"); return; }
    let link = path.trim();
    if (link) {
      try { if (/^https?:/i.test(link)) { const u = new URL(link); link = u.pathname + u.search; } } catch { /* keep */ }
      if (!link.startsWith("/")) link = `/${link}`;
    }
    const who = audience === "all" ? "everyone with the app" : "this club's followers";
    if (!confirm(`Send this notification to ${who}?`)) return;
    setBusy(true);
    try {
      await sendPush({ kind: "custom", titleEn, bodyEn, titleAr, bodyAr, path: link || null, audience: audience === "team" && teamId ? { type: "team", teamId } : { type: "all" } });
      toast.success("Notification sent");
      setTitleEn(""); setBodyEn(""); setTitleAr(""); setBodyAr(""); setPath("");
      setTimeout(() => qc.invalidateQueries({ enabled: isOwner,
    queryKey: ["admin", "push-recent"] }), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally { setBusy(false); }
  };

  if (!isOwner) return null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <div>
        <h2 className="text-lg font-bold">Send a notification</h2>
        <p className="text-sm text-muted-foreground">Goes to phones with the MA Scores app. Fill English, Arabic or both — phones set to Arabic get the Arabic text.</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title (English)"><input className={inputCls} maxLength={120} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} /></Field>
          <Field label="العنوان (Arabic)"><input dir="rtl" className={inputCls} maxLength={120} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} /></Field>
          <Field label="Message (English)"><textarea rows={3} className={inputCls} maxLength={400} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} /></Field>
          <Field label="الرسالة (Arabic)"><textarea dir="rtl" rows={3} className={inputCls} maxLength={400} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} /></Field>
        </div>
        <Field label="Opens page (optional, e.g. /matches/… or /news/…)"><input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" /></Field>
        <Field label="Send to">
          <div className="flex flex-wrap gap-2">
            {(["all", "team"] as const).map((a) => (
              <button key={a} type="button" onClick={() => setAudience(a)} className={`h-10 rounded-full px-4 text-xs font-semibold ${audience === a ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                {a === "all" ? "Everyone" : "Followers of a club"}
              </button>
            ))}
          </div>
        </Field>
        {audience === "team" && <TeamSelect teams={teams.data ?? []} value={teamId} onChange={(id) => setTeamId(id)} allowFreeAgent={false} />}
        <div className="flex justify-end">
          <button className={btnPrimary} disabled={busy} onClick={send}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send notification</button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Recently sent</h3>
        <div className="grid min-w-0 grid-cols-1 gap-2">
          {(recent.data ?? []).map((r) => (
            <div key={r.id} className="min-w-0 break-words [overflow-wrap:anywhere] rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words font-semibold">{r.title_en}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase">{r.kind}</span>
              </div>
              {r.body_en && <div className="break-words text-xs text-muted-foreground">{r.body_en}</div>}
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · {r.audience_type === "all" ? "Everyone" : "Club followers"} ·{" "}
                {r.result?.error ? <span className="text-destructive">Failed: {r.result.error}</span>
                  : r.result ? `${r.result.sent ?? 0} delivered${r.result.failed ? `, ${r.result.failed} failed` : ""}`
                  : "Sending…"}
              </div>
            </div>
          ))}
          {recent.data && recent.data.length === 0 && <div className="min-w-0 break-words [overflow-wrap:anywhere] rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nothing sent yet.</div>}
        </div>
      </div>
    </div>
  );
}
