import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2 } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Request verification — MA Scores" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Ask the MA Scores team to verify your account with proof of who you are." },
      { property: "og:title", content: "Request verification — MA Scores" },
      { property: "og:description", content: "Ask the MA Scores team to verify your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [proof, setProof] = useState("");
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = useQuery({
    enabled: !!user,
    queryKey: ["my-verification", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("id,status,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const submit = async () => {
    if (!user || !proof.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("verification_requests").insert({
      user_id: user.id,
      proof: proof.trim(),
      links: links.trim() || null,
    } as never);
    setBusy(false);
    if (error) { toast.error("Could not send your request. Please try again."); return; }
    toast.success("Request sent. The team will review it.");
    qc.invalidateQueries({ queryKey: ["my-verification", user.id] });
    setProof(""); setLinks("");
  };

  if (loading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  if (!user) {
    navigate({ to: "/auth" });
    return <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }

  const status = existing.data?.status;

  return (
    <AppShell>
      <BackButton />
      <div className="mt-3 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-lg font-bold"><BadgeCheck className="h-5 w-5 text-primary" /> Request verification</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us who you are and share proof — links to your Instagram, news articles about you, or other sources. The team reviews every request by hand.
        </p>

        {status === "pending" && (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            Your request is waiting for review.
          </div>
        )}
        {status === "approved" && (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            Your account is verified. Congratulations!
          </div>
        )}
        {status === "rejected" && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Your last request was not approved. You can send a new one with stronger proof below.
          </div>
        )}

        {status !== "pending" && status !== "approved" && (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">Who are you?
              <textarea value={proof} onChange={(e) => setProof(e.target.value)} rows={4}
                placeholder="Tell us about yourself and why your account should be verified…"
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-base font-normal outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-semibold">Proof links
              <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={3}
                placeholder={"https://instagram.com/you\nhttps://news-site.com/article-about-you"}
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-base font-normal outline-none focus:border-primary" />
              <span className="mt-1 block text-[0.65rem] font-normal text-muted-foreground">One link per line — Instagram, X, news articles, anything that proves it is you.</span>
            </label>
            <button onClick={submit} disabled={busy || !proof.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
