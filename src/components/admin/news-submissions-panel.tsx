import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify } from "@/lib/db";
import { Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { Check, X, FileText, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteReporter } from "@/lib/reporter-admin.functions";
import { setUserSuspension } from "@/lib/moderation.functions";
import { Ban } from "lucide-react";
import { BanHistory } from './ban-history';
import { viewReporterIdentity } from '@/lib/reporter.functions';
import { Button } from '@/components/ui/button';

type Submission = {
  id: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  cover_url: string | null;
  proof_note: string | null;
  proof_url: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  author_id: string;
  team_id: string | null;
  competition_id: string | null;
  player_id: string | null;
};

/** Main-admin review queue for articles submitted by subscribed reporters. */
export function NewsSubmissionsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Submission | null>(null);
  const [note, setNote] = useState("");
  const [reporterError, setReporterError] = useState<string | null>(null);
  const removeReporter = useServerFn(deleteReporter);
  const suspend = useServerFn(setUserSuspension);
  const viewIdentity = useServerFn(viewReporterIdentity);
  const [identityUrl, setIdentityUrl] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ userId: string; permanent: boolean } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const banReporter = async (userId: string, permanent: boolean) => {
    const reason = banReason.trim();
    if (!reason) return;
    setBanning(true);
    setReporterError(null);
    try { const result = await suspend({ data: { userId, banned: permanent, days: 1, reason } }); setReporterError(result.banned ? "Permanently banned." : `Banned until ${new Date(result.suspendedUntil!).toLocaleString()}.`); qc.invalidateQueries({ queryKey: ['ban-history', userId] }); qc.invalidateQueries({ queryKey: ['admin-users'] }); setBanTarget(null); }
    catch (e) { setReporterError(e instanceof Error ? e.message : "Could not ban."); }
    finally { setBanning(false); }
  };

  const q = useQuery({
    queryKey: ["admin", "news-submissions"],
    queryFn: async () => {
      const { data } = await supabase.from("news_submissions").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Submission[];
    },
  });

  const reporters = useQuery({
    queryKey: ["admin", "news-reporters"],
    queryFn: async () => {
      const { data } = await supabase.from("news_reporters").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = async (s: Submission) => {
    const author = (reporters.data ?? []).find((r) => r.user_id === s.author_id);
    await supabase.from("news_posts").insert({
      author_display: author?.handle ? `@${author.handle}` : null,
      title: s.title,
      slug: slugify(s.title),
      body_markdown: s.body_markdown,
      excerpt: s.excerpt,
      cover_url: s.cover_url,
      team_id: s.team_id,
      competition_id: s.competition_id,
      player_id: s.player_id,
      published_at: new Date().toISOString(),
    } as never);
    await supabase.from("news_submissions").update({ status: "approved", review_note: note || null }).eq("id", s.id);
    setOpen(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin", "news-submissions"] });
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const reject = async (s: Submission) => {
    await supabase.from("news_submissions").update({ status: "rejected", review_note: note || null }).eq("id", s.id);
    setOpen(null); setNote("");
    qc.invalidateQueries({ queryKey: ["admin", "news-submissions"] });
  };

  const setReporter = async (id: string, status: string) => {
    await supabase.from("news_reporters").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "news-reporters"] });
  };

  /** Turning a reporter down removes the account entirely. */
  const rejectReporter = async (id: string) => {
    setReporterError(null);
    try {
      await removeReporter({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin", "news-reporters"] });
      qc.invalidateQueries({ queryKey: ["admin", "news-submissions"] });
    } catch (e) {
      setReporterError(e instanceof Error ? e.message : "Could not remove that reporter.");
    }
  };

  /** Generate an access code to send the reporter manually — they redeem it themselves. */
  const generateCode = async (id: string) => {
    const code = `MAS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await supabase.from("news_reporters").update({ access_code: code }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "news-reporters"] });
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Reporter submissions</h2>
      <div className="grid gap-2">
        {(q.data ?? []).map((s) => (
          <button key={s.id} onClick={() => { setOpen(s); setNote(s.review_note ?? ""); }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/50">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{s.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${s.status === "approved" ? "bg-emerald-500/15 text-emerald-500" : s.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"}`}>{s.status}</span>
          </button>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No submissions yet.</div>}
      </div>

      <h3 className="mb-3 mt-8 text-base font-bold">News requests</h3>
      {reporterError && <p className="mb-2 text-xs font-semibold text-destructive">{reporterError}</p>}
      <div className="grid gap-2">
        {(reporters.data ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{r.full_name ? `${r.full_name} · ` : ""}@{r.handle} <span className="text-xs font-normal text-muted-foreground">· {r.platform}</span></div>
              <div className="text-xs text-muted-foreground">{[r.phone, r.email].filter(Boolean).join(" · ") || "No contact supplied"}</div>
              {(() => { const x = r as typeof r & { national_id?: string | null; entity_type?: string | null; company_name?: string | null; social_links?: Record<string, string> | null };
                const socials = Object.entries(x.social_links ?? {}).map(([k, v]) => `${k}: @${v}`).join(" · ");
                return (<div className="text-xs text-muted-foreground">{x.entity_type === "company" ? `Company${x.company_name ? ` · ${x.company_name}` : ""}` : "Individual"}{x.national_id ? ` · ID ${x.national_id}` : ""}{socials ? ` · ${socials}` : ""}</div>); })()}
              <div className="text-xs text-muted-foreground">Code: <span className="font-mono">{r.access_code ?? "—"}</span>{r.code_redeemed_at ? " · redeemed" : ""}</div>
              <BanHistory userId={r.user_id} />
            </div>
            {r.civil_id_photo_path && <Button variant="outline" size="sm" onClick={async () => { setReporterError(null); try { const result = await viewIdentity({ data: { id: r.id } }); setIdentityUrl(result.url); } catch (error) { setReporterError(error instanceof Error ? error.message : 'Could not open photo.'); } }}>Civil ID photo</Button>}
            <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">{r.status}</span>
            <button className={btnGhost} onClick={() => generateCode(r.id)}><KeyRound className="h-3.5 w-3.5" /> Generate code</button>
            <button className={btnGhost} onClick={() => setReporter(r.id, "active")}><Check className="h-3.5 w-3.5" /> Activate</button>
            <button className={btnGhost} onClick={() => { setBanReason(''); setBanTarget({ userId: r.user_id, permanent: false }); }}><Ban className="h-3.5 w-3.5" /> Ban / next strike</button>
            <button className={btnDanger} onClick={() => { setBanReason(''); setBanTarget({ userId: r.user_id, permanent: true }); }}><Ban className="h-3.5 w-3.5" /> Ban forever</button>
            <button className={btnDanger} onClick={() => rejectReporter(r.id)}><Trash2 className="h-3.5 w-3.5" /> Reject &amp; delete</button>
          </div>
        ))}
        {reporters.data && reporters.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No reporter applications yet.</div>}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title="Review submission" wide>
        {open && (
          <div className="grid gap-3">
            {open.cover_url && <img src={open.cover_url} alt="" className="max-h-72 w-full rounded-2xl bg-muted/60 object-contain" />}
            <div className="text-lg font-bold">{open.title}</div>
            {open.excerpt && <div className="text-sm text-muted-foreground">{open.excerpt}</div>}
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-background p-3 text-sm">{open.body_markdown}</div>
            <div className="rounded-2xl border border-dashed border-border p-3 text-sm">
              <div className="font-semibold">Proof supplied</div>
              <div className="mt-1 text-muted-foreground">{open.proof_note || "No note"}</div>
              {open.proof_url && <a href={open.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Open attachment <ExternalLink className="h-3 w-3" /></a>}
            </div>
            <textarea className={inputCls} rows={2} placeholder="Note back to the reporter (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className={btnDanger} onClick={() => reject(open)}><X className="h-3.5 w-3.5" /> Reject</button>
              <button className={btnPrimary} onClick={() => approve(open)}><Check className="h-3.5 w-3.5" /> Approve & publish</button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!identityUrl} onClose={() => setIdentityUrl(null)} title="Civil ID photo">
        {identityUrl && <img src={identityUrl} alt="Applicant civil ID" className="max-h-[65vh] w-full object-contain" />}
      </Modal>
      <Modal open={!!banTarget} onClose={() => { if (!banning) setBanTarget(null); }} title={banTarget?.permanent ? 'Permanent ban' : 'Ban / next strike'}>
        {banTarget && <div className="space-y-3">
          <BanHistory userId={banTarget.userId} />
          <p className="text-xs text-muted-foreground">First strike: 1 day. Second strike: 1 week. Third strike: permanent. Ban history remains after restrictions expire or are lifted.</p>
          <textarea aria-label="Ban reason" className={inputCls} placeholder="Reason shown to this user" value={banReason} onChange={(event) => setBanReason(event.target.value)} />
          <Button variant="destructive" disabled={banning || !banReason.trim()} onClick={() => banReporter(banTarget.userId, banTarget.permanent)}>{banning ? 'Saving…' : 'Confirm ban'}</Button>
        </div>}
      </Modal>
    </div>
  );
}
