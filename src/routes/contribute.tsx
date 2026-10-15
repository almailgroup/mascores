import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { uploadMedia } from "@/components/admin/upload";
import { NewsLinkPicker, type NewsLinks } from "@/components/admin/news-link-picker";
import { redeemReporterCode, applyAsReporter } from "@/lib/reporter.functions";
import { Button } from '@/components/ui/button';
import { Loader2, LogIn, ImagePlus, Send, BadgeCheck, Mail, KeyRound, Share2, CheckCircle2, Pencil, Trash2, X, FileText } from "lucide-react";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title: "Reporter desk — MansourAlmailScores" },
      { name: "description", content: "Join the MansourAlmailScores reporter programme and submit football news for editorial review." },
      { property: "og:title", content: "Reporter desk — MansourAlmailScores" },
      { property: "og:description", content: "Submit football news for review as a subscribed MansourAlmailScores reporter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContributePage,
});

const PLATFORMS = ["instagram", "tiktok", "x", "snapchat", "youtube", "facebook", "other"] as const;
const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-primary sm:text-sm";

function ContributePage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [platform, setPlatform] = useState<string>("instagram");
  const [handle, setHandle] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<"individual" | "company">("individual");
  const [companyName, setCompanyName] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const redeem = useServerFn(redeemReporterCode);
  const sendApplication = useServerFn(applyAsReporter);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [links, setLinks] = useState<NewsLinks>({ team_id: null, competition_id: null, player_id: null });
  const [proofNote, setProofNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "proof" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [proofIsImage, setProofIsImage] = useState(false);

  const reporter = useQuery({
    enabled: !!user,
    queryKey: ["reporter", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("news_reporters").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("news_submissions").select("*").eq("author_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const canApply = !!handle.trim() && !!fullName.trim() && phone.trim().length >= 6 && /^\S+@\S+\.\S+$/.test(contactEmail.trim()) && !!identityFile && (entityType === "individual" || !!companyName.trim());
  const apply = async () => {
    if (!canApply || !user) return;
    const social_links = Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim().replace(/^@/, "")]).filter(([, v]) => v));
    setApplying(true); setApplyError(null);
    try {
      if (!identityFile || !['image/jpeg', 'image/png', 'image/webp'].includes(identityFile.type) || identityFile.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP civil ID photo under 5 MB.');
      const extension = identityFile.type === 'image/png' ? 'png' : identityFile.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('reporter-identity').upload(path, identityFile, { contentType: identityFile.type });
      if (uploadError) throw uploadError;
      await sendApplication({ data: {
        platform: platform as typeof PLATFORMS[number], handle: handle.replace(/^@/, ''), full_name: fullName.trim(),
        phone: phone.trim(), email: contactEmail.trim(), civil_id_photo_path: path,
        entity_type: entityType, company_name: entityType === 'company' ? companyName.trim() : null, social_links,
      } });
      await qc.invalidateQueries({ queryKey: ['reporter', user.id] });
    } catch (error) { setApplyError(error instanceof Error ? error.message : 'Could not send your details.'); }
    finally { setApplying(false); }
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setCodeBusy(true); setCodeMsg(null);
    try {
      const res = await redeem({ data: { code: code.trim() } });
      if (res.ok) { setCodeMsg(null); qc.invalidateQueries({ queryKey: ["reporter", user?.id] }); }
      else setCodeMsg(res.reason === "no-application" ? "Register your details first." : "That access code is not valid yet.");
    } catch { setCodeMsg("Could not check that code. Please try again."); }
    finally { setCodeBusy(false); }
  };

  const uploadArticleFile = async (file: File, kind: "cover" | "proof") => {
    if (!user) return;
    setUploading(kind); setError(null);
    try {
      if (kind === "cover" && !file.type.startsWith("image/")) throw new Error("Choose an image for your cover.");
      if (file.size > 20 * 1024 * 1024) throw new Error("Choose a file smaller than 20 MB.");
      const url = await uploadMedia("news-covers", file, user.id);
      if (!url) throw new Error("The file could not be uploaded. Please try again.");
      if (kind === "cover") setCover(url); else { setProofUrl(url); setProofIsImage(file.type.startsWith("image/")); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not upload the file."); }
    finally { setUploading(null); }
  };

  const submit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setBusy(true); setError(null);
    const payload = {
      title: title.trim(),
      excerpt: excerpt || null,
      body_markdown: body,
      cover_url: cover,
      proof_note: proofNote || null,
      proof_url: proofUrl,
      ...links,
    };
    const { data: saved, error: err } = editingId
      ? await supabase.from("news_submissions").update({ ...payload, status: "pending", review_note: null }).eq("id", editingId).eq("author_id", user.id).in("status", ["pending", "rejected"]).select("id")
      : await supabase.from("news_submissions").insert({ ...payload, author_id: user.id }).select("id");
    setBusy(false);
    if (err) { setError(err.message); return; }
    if (!saved?.length) { setError("This submission has already been approved and can no longer be edited."); return; }
    setSent(true);
    setTitle(""); setExcerpt(""); setBody(""); setCover(null); setProofNote(""); setProofUrl(null);
    setEditingId(null); setProofIsImage(false);
    qc.invalidateQueries({ queryKey: ["my-submissions", user.id] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <h1 className="text-3xl font-black tracking-tight">{t("settings.reporter")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("settings.reporterHint")}</p>

      {!user ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t("settings.signInHint")}</p>
          <Link to="/auth" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            <LogIn className="h-4 w-4" /> {t("nav.signIn")}
          </Link>
        </div>
      ) : reporter.isPending ? (
        <div className="mt-6 flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your reporter status…
        </div>
      ) : !reporter.data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-6">
            <div className="flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4 text-primary" /> How to get access</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Contact <a href="mailto:mansouralmailscores@gmail.com" className="font-semibold text-primary">mansouralmailscores@gmail.com</a> to be given access to the news desk. The
              <strong className="text-foreground"> 3 KWD / month subscription is included</strong> with your reporter access.
            </p>
            <ul className="mt-4 grid gap-2 text-sm">
              {[
                "Publish football news that the main admin reviews before it goes live",
                "Show your own social media username on every article you publish",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="text-muted-foreground">{line}</span></li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">Register your details</div>
            <p className="mt-1 text-xs text-muted-foreground">The main admin checks your information and replies with an access code.</p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full name</label>
                <input className={`${inputCls} mt-1`} maxLength={120} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">You are</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["individual", "company"] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setEntityType(k)}
                      className={`h-10 rounded-xl border text-sm font-semibold ${entityType === k ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                      {k === "individual" ? "Individual" : "Company"}
                    </button>
                  ))}
                </div>
              </div>
              {entityType === "company" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Company name</label>
                  <input className={`${inputCls} mt-1`} maxLength={160} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              )}
              <div>
                <label htmlFor="civil-id-photo" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Civil ID photo</label>
                <input id="civil-id-photo" type="file" accept="image/jpeg,image/png,image/webp" className={`${inputCls} mt-1`} onChange={(e) => { setIdentityFile(e.target.files?.[0] ?? null); setApplyError(null); }} />
                <p className="mt-1 text-xs text-muted-foreground">Private · visible only to you and the main admin. JPG, PNG or WebP, up to 5 MB.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phone</label>
                  <input className={`${inputCls} mt-1`} maxLength={40} placeholder="+965…" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input className={`${inputCls} mt-1`} maxLength={160} placeholder="you@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Platform</label>
                  <select className={`${inputCls} mt-1`} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Username</label>
                  <input className={`${inputCls} mt-1`} placeholder="@username" value={handle} onChange={(e) => setHandle(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Other social media (optional)</label>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {PLATFORMS.filter((p) => p !== "other" && p !== platform).map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs font-semibold capitalize text-muted-foreground">{p === "x" ? "X" : p}</span>
                      <input className={inputCls} placeholder="@username" value={socials[p] ?? ""} onChange={(e) => setSocials((s) => ({ ...s, [p]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
              <Button disabled={applying || !canApply} onClick={apply}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Send my details
              </Button>
              <p className="text-[0.7rem] text-muted-foreground">Name, civil ID photo, phone and email are required for verification.</p>
              <p className="text-xs text-muted-foreground">False information, impersonation or deliberate misuse of the news service will result in an account ban. Repeated violations lead to longer bans and ultimately a permanent ban.</p>
              {applyError && <p className="text-xs text-destructive">{applyError}</p>}
            </div>
          </section>
        </div>
      ) : !["active", "approved"].includes(reporter.data.status ?? "") ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-border bg-card p-6 text-sm">
          <div className="font-semibold">Your details are with the main admin</div>
          <p className="mt-1 text-muted-foreground">{reporter.data.full_name ? `${reporter.data.full_name} · ` : ""}@{reporter.data.handle} on {reporter.data.platform}.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Email <a href="mailto:mansouralmailscores@gmail.com" className="font-semibold text-primary">mansouralmailscores@gmail.com</a> if you have not heard back. Once the admin sends your
            access code, enter it below to open the news desk. Subscription $2.99 / month is included.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5 text-primary" /> Access code</span>
            <input className={`${inputCls} max-w-[12rem]`} placeholder="MAS-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
            <button disabled={codeBusy || !code.trim()} onClick={submitCode} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {codeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Unlock news desk
            </button>
          </div>
          {codeMsg && <div className="mt-2 text-xs text-destructive">{codeMsg}</div>}
        </section>
      ) : (
        <section className="mt-6 grid gap-4">
          <div ref={editorRef} className="rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold">{editingId ? "Edit submission" : "Write an article"}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Everything you send is read by the main admin before it goes live. Your username
                  <strong className="text-foreground"> @{reporter.data.handle}</strong> is shown on your published articles.
                </p>
              </div>
              {sent && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-500">Sent for review</span>}
            </div>

            <div className="mt-5 grid gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Headline</label>
                <input className={`${inputCls} mt-1`} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Short summary</label>
                <input className={`${inputCls} mt-1`} maxLength={280} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One line that appears on the news card" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Article</label>
                <textarea className={`${inputCls} mt-1`} rows={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the full story here" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cover photo</label>
                  <label className="mt-1 flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" /> {uploading === "cover" ? "Uploading…" : cover ? "Change photo" : "Choose photo"}
                    <input type="file" accept="image/*" disabled={!!uploading} className="sr-only"
                      onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await uploadArticleFile(f, "cover"); }} />
                  </label>
                  {cover && <img src={cover} alt="Cover preview" className="mt-2 max-h-60 w-full rounded-lg bg-muted/60 object-contain" />}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Proof (photo or document)</label>
                  <label className="mt-1 flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" /> {uploading === "proof" ? "Uploading…" : proofUrl ? "Change file" : "Choose file"}
                    <input type="file" disabled={!!uploading} className="sr-only"
                      onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await uploadArticleFile(f, "proof"); }} />
                  </label>
                  {proofUrl && (proofIsImage || /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(proofUrl)
                    ? <img src={proofUrl} alt="Proof preview" className="mt-2 max-h-60 w-full rounded-lg bg-muted/60 object-contain" />
                    : <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all text-sm text-primary"><FileText className="h-4 w-4 shrink-0" />Open proof document</a>)}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Where does it belong?</label>
                <div className="mt-1"><NewsLinkPicker teamId={links.team_id} competitionId={links.competition_id} playerId={links.player_id} onChange={setLinks} /></div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Note about your proof</label>
                <textarea className={`${inputCls} mt-1`} rows={2} value={proofNote} onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Where did this come from? Add your social media post link too." />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button disabled={busy || !!uploading || !title.trim() || !body.trim()} onClick={submit}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {editingId ? "Save for review" : "Send for review"}
              </Button>
              {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setTitle(""); setExcerpt(""); setBody(""); setCover(null); setProofUrl(null); setProofNote(""); setError(null); }}><X className="h-4 w-4" />Cancel editing</Button>}
              <p className="text-xs text-muted-foreground">False information, impersonation or deliberate misuse of the news service will result in an account ban. Repeated violations lead to longer bans and ultimately a permanent ban.</p>
            </div>
          </div>


          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">Your submissions</div>
            <div className="mt-3 grid gap-2">
              {(mine.data ?? []).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.title}</div>
                    {s.review_note && <div className="truncate text-xs text-muted-foreground">{s.review_note}</div>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">{s.status}</span>
                  {s.status !== "approved" && <Button variant="ghost" size="icon" aria-label={`Edit ${s.title}`} title="Edit submission" disabled={busy} onClick={() => {
                    setEditingId(s.id); setTitle(s.title); setExcerpt(s.excerpt ?? ""); setBody(s.body_markdown); setCover(s.cover_url); setProofUrl(s.proof_url); setProofIsImage(false); setProofNote(s.proof_note ?? ""); setLinks({ team_id: s.team_id, competition_id: s.competition_id, player_id: s.player_id }); setError(null); setSent(false); editorRef.current?.scrollIntoView({ block: "start" });
                  }}><Pencil className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" aria-label={`Delete ${s.title}`} title="Delete submission" disabled={deletingId === s.id || busy} onClick={async () => {
                    if (!user || !window.confirm("Delete this submission? This cannot be undone.")) return;
                    setDeletingId(s.id); setError(null);
                    try {
                      const { data, error } = await supabase.from("news_submissions").delete().eq("id", s.id).eq("author_id", user.id).select("id");
                      if (error) throw error;
                      if (!data?.length) throw new Error("Could not delete this submission.");
                      if (editingId === s.id) { setEditingId(null); setTitle(""); setBody(""); setExcerpt(""); setCover(null); setProofUrl(null); setProofNote(""); }
                      await qc.invalidateQueries({ queryKey: ["my-submissions", user.id] });
                    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete this submission."); }
                    finally { setDeletingId(null); }
                  }}>{deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}</Button>
                </div>
              ))}
              {mine.data && mine.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing submitted yet.</div>}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
