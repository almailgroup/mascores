import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BrandLogo } from "@/components/brand-logo";
import { TicketScanner } from "@/components/ticket-scanner";
import { useAuth } from "@/hooks/use-auth";
import { myAccess } from "@/lib/owner.functions";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Ticket scanner — MansourAlmailScores" },
      { name: "description", content: "Gate staff scan supporter tickets here. Each QR code is accepted once." },
      { property: "og:title", content: "Ticket scanner — MansourAlmailScores" },
      { property: "og:description", content: "Gate staff scan supporter tickets here. Each QR code is accepted once." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScannerPage,
});

/** A page with nothing but ticket scanning, for the people working the gate. */
function ScannerPage() {
  const { user, loading } = useAuth();
  const access = useServerFn(myAccess);
  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-access", user?.id],
    queryFn: () => access({}),
  });

  const allowed = !!mine.data && (mine.data.isOwner || mine.data.grants.some((g) => g.scope === "scanner" || g.scope === "tickets" || g.scope === "all"));

  return (
    <AppShell bare>
      <div className="mx-auto max-w-xl px-4 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <BrandLogo className="h-9" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.7rem] font-black uppercase tracking-widest text-primary">
            <ScanLine className="h-3.5 w-3.5" /> Scanner
          </span>
        </div>

        {loading || (user && mine.isLoading) ? (
          <div className="grid place-items-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="font-bold">Sign in to scan</p>
            <p className="mt-1 text-muted-foreground">Use the account you were given for the gate.</p>
            <Link to="/auth" className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">Sign in</Link>
          </div>
        ) : !allowed ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="font-bold">No scanning access on this account</p>
            <p className="mt-1 text-muted-foreground">Ask the site owner to give this account scanning access.</p>
          </div>
        ) : (
          <TicketScanner />
        )}
      </div>
    </AppShell>
  );
}
