import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ticket as TicketIcon, Loader2, CheckCircle2, Clock, CreditCard, ArrowRight, X, Sparkles } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { QrCode } from "@/components/qr-code";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { claimTicket } from "@/lib/tickets.functions";
import { formatKickoff } from "@/lib/db";
import { useTx } from "@/lib/auto-translate";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Match tickets — MansourAlmailScores" },
      { name: "description", content: "Browse tickets for upcoming football matches, see prices and stands, and keep your QR ticket ready for the gate." },
      { property: "og:title", content: "Match tickets — MansourAlmailScores" },
      { property: "og:description", content: "Tickets for upcoming matches with instant QR entry passes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketsPage,
});

type OfferRow = {
  id: string; match_id: string; name: string; stand: string | null; price: number; currency: string;
  is_free: boolean; capacity: number | null; notes: string | null;
  match: { id: string; kickoff_at: string | null; status: string; venue: string | null;
    home: { name: string; logo_url: string | null } | null;
    away: { name: string; logo_url: string | null } | null;
    competition: { name: string; slug: string; logo_url: string | null } | null } | null;
};

type MyTicket = {
  id: string; code: string; status: string; row_label: string | null; seat_label: string | null;
  holder_name: string | null; price_paid: number; currency: string; used_at: string | null;
  offer: { name: string; stand: string | null } | null;
  match: { kickoff_at: string | null; venue: string | null; home: { name: string } | null; away: { name: string } | null; competition: { name: string } | null } | null;
};

function TicketsPage() {
  const tx = useTx();
  const { user } = useAuth();
  const [checkout, setCheckout] = useState<OfferRow | null>(null);

  const offers = useQuery({
    queryKey: ["ticket-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_offers")
        .select("id, match_id, name, stand, price, currency, is_free, capacity, notes, match:match_id(id, kickoff_at, status, venue, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url), competition:competition_id(name, slug, logo_url))")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, code, status, row_label, seat_label, holder_name, price_paid, currency, used_at, created_at, offer:offer_id(name, stand), match:match_id(kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as MyTicket[];
    },
  });

  const grouped = new Map<string, OfferRow[]>();
  for (const offer of offers.data ?? []) {
    const list = grouped.get(offer.match_id) ?? [];
    list.push(offer);
    grouped.set(offer.match_id, list);
  }

  return (
    <AppShell>
      <BackButton />
      <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5">
        <div className="flex items-center gap-2 text-primary"><TicketIcon className="h-5 w-5" /><span className="text-[0.7rem] font-bold uppercase tracking-widest">{tx("Tickets")}</span></div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{tx("Match tickets")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{tx("Pick a match, add your details and we generate your QR pass instantly. Online payment is coming soon.")}</p>
      </div>

      {offers.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : offers.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">{tx("Tickets could not be loaded. Please try again.")}</div>
      ) : grouped.size === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{tx("No tickets on sale right now.")}</div>
      ) : (
        <div className="space-y-3">
          {[...grouped.values()].map((list) => {
            const m = list[0]!.match;
            return (
              <div key={list[0]!.match_id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
                  {m?.competition?.logo_url && <img src={m.competition.logo_url} alt="" className="h-7 w-7 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{tx(m?.home?.name ?? "TBD")} <span className="text-muted-foreground">{tx("vs")}</span> {tx(m?.away?.name ?? "TBD")}</div>
                    <div className="truncate text-[0.7rem] text-muted-foreground">
                      {[m?.competition ? tx(m.competition.name) : null, formatKickoff(m?.kickoff_at ?? null), m?.venue ? tx(m.venue) : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {m?.competition && <Link to="/competitions/$slug" params={{ slug: m.competition.slug }} className="shrink-0 text-xs font-semibold text-primary">{tx("Match")}</Link>}
                </div>
                <div className="divide-y divide-border/70">
                  {list.map((offer) => (
                    <div key={offer.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{tx(offer.name)}{offer.stand ? ` · ${tx(offer.stand)}` : ""}</div>
                        {offer.notes && <div className="truncate text-[0.7rem] text-muted-foreground">{tx(offer.notes)}</div>}
                      </div>
                      <div className="text-sm font-black tabular-nums">{offer.is_free ? tx("Free") : `${offer.price} ${offer.currency}`}</div>
                      <button
                        onClick={() => setCheckout(offer)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
                      >
                        {offer.is_free ? tx("Get ticket") : tx("Buy ticket")} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">{tx("My tickets")}</h2>
      {!user ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {tx("Sign in to see your tickets.")} <Link to="/auth" className="font-semibold text-primary">{tx("Sign in")}</Link>
        </div>
      ) : (mine.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{tx("No tickets yet.")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(mine.data ?? []).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
        </div>
      )}

      {checkout && <CheckoutModal offer={checkout} onClose={() => setCheckout(null)} />}
    </AppShell>
  );
}

/** Branded ticket design with QR code, seat details and validity state. */
function TicketCard({ ticket }: { ticket: MyTicket }) {
  const tx = useTx();
  const used = ticket.status === "used";
  const m = ticket.match;
  return (
    <div className={`relative overflow-hidden rounded-3xl border ${used ? "border-border bg-muted/40" : "border-primary/40 bg-card"}`}>
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/70 px-4 py-2.5 text-primary-foreground">
        <span className="text-[0.65rem] font-black uppercase tracking-[0.2em]">{tx("Entry pass")}</span>
        <span className="text-[0.65rem] font-bold">{ticket.price_paid > 0 ? `${ticket.price_paid} ${ticket.currency}` : tx("Free")}</span>
      </div>
      <div className="flex gap-3 p-4">
        <div className="shrink-0 rounded-2xl border border-border bg-background p-2">
          <QrCode value={ticket.code} size={104} className={used ? "opacity-40" : ""} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{tx(m?.home?.name ?? "TBD")} — {tx(m?.away?.name ?? "TBD")}</div>
          <div className="truncate text-[0.7rem] text-muted-foreground">{[m?.competition ? tx(m.competition.name) : null, formatKickoff(m?.kickoff_at ?? null)].filter(Boolean).join(" · ")}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem] text-muted-foreground">
            {ticket.offer && <span className="font-semibold text-foreground">{tx(ticket.offer.name)}</span>}
            {ticket.holder_name && <span>{ticket.holder_name}</span>}
            {ticket.row_label && <span>{tx("Row")} {ticket.row_label}</span>}
            {ticket.seat_label && <span>{tx("Seat")} {ticket.seat_label}</span>}
            {m?.venue && <span>{tx(m.venue)}</span>}
          </div>
          <div className="mt-2 font-mono text-[0.65rem] tracking-wider text-muted-foreground">{ticket.code}</div>
          <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${used ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            {used ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {used ? tx("Scanned") : tx("Valid — scan once at the gate")}
          </div>
        </div>
      </div>
      <span className="absolute -start-2 top-1/2 h-4 w-4 rounded-full bg-background" />
      <span className="absolute -end-2 top-1/2 h-4 w-4 rounded-full bg-background" />
    </div>
  );
}

type Step = "details" | "payment" | "issuing" | "done";

/** Details → payment (coming soon, skippable) → generating → the finished ticket. */
function CheckoutModal({ offer, onClose }: { offer: OfferRow; onClose: () => void }) {
  const tx = useTx();
  const { user } = useAuth();
  const qc = useQueryClient();
  const claim = useServerFn(claimTicket);
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<MyTicket | null>(null);

  const issue = async () => {
    setStep("issuing");
    setError(null);
    try {
      const res = await claim({ data: {
        offerId: offer.id,
        holderName: name.trim() || undefined,
        holderEmail: email.trim() || undefined,
        holderPhone: phone.trim() || undefined,
        accessCode: code.trim() || undefined,
        skipPayment: true,
      } });
      if (!res.ok) {
        setError(res.reason === "sold_out" ? tx("This ticket is sold out.") : tx("This ticket is no longer available."));
        setStep("payment");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
      const { data } = await supabase
        .from("tickets")
        .select("id, code, status, row_label, seat_label, holder_name, price_paid, currency, used_at, offer:offer_id(name, stand), match:match_id(kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))")
        .eq("id", res.ticketId)
        .maybeSingle();
      setIssued((data ?? null) as unknown as MyTicket | null);
      setStep("done");
    } catch {
      setError(tx("Something went wrong. Please try again."));
      setStep("payment");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.65rem] font-bold uppercase tracking-widest text-primary">{tx(offer.name)}</div>
            <h2 className="truncate text-lg font-black">{tx(offer.match?.home?.name ?? "TBD")} — {tx(offer.match?.away?.name ?? "TBD")}</h2>
            <div className="text-xs text-muted-foreground">{formatKickoff(offer.match?.kickoff_at ?? null)}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {!user ? (
          <div className="rounded-2xl border border-border p-4 text-sm">
            {tx("Sign in to get your ticket.")}
            <Link to="/auth" className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground">{tx("Sign in")}</Link>
          </div>
        ) : step === "details" ? (
          <div className="space-y-3">
            <Labeled label={tx("Full name")}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} placeholder={tx("Full name")} /></Labeled>
            <Labeled label={tx("Email")}><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={fieldCls} /></Labeled>
            <Labeled label={tx("Phone")}><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={fieldCls} /></Labeled>
            <Labeled label={tx("Admin code (optional)")}><input value={code} onChange={(e) => setCode(e.target.value)} className={fieldCls} placeholder="MAMA2026" /></Labeled>
            <button disabled={!name.trim()} onClick={() => setStep("payment")}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
              {tx("Continue")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : step === "payment" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold"><CreditCard className="h-4 w-4 text-primary" /> {tx("Payment")}</div>
              <div className="mt-1 text-2xl font-black tabular-nums">{offer.is_free ? tx("Free") : `${offer.price} ${offer.currency}`}</div>
              <p className="mt-2 text-xs text-muted-foreground">{tx("Online payment is coming soon. You can skip it for now and your pass will still be generated.")}</p>
            </div>
            {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</div>}
            <button disabled className="inline-flex h-11 w-full items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {tx("Pay now — coming soon")}
            </button>
            <button onClick={issue} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {tx("Skip and get my ticket")} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setStep("details")} className="h-9 w-full text-xs font-semibold text-muted-foreground">{tx("Back")}</button>
          </div>
        ) : step === "issuing" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <div className="text-sm font-bold">{tx("Please wait for your ticket…")}</div>
            <p className="text-xs text-muted-foreground">{tx("We are generating your QR pass.")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" /> {tx("Your ticket is ready")}</div>
            {issued && <TicketCard ticket={issued} />}
            <p className="text-xs text-muted-foreground">{tx("Keep this QR code — it can be scanned only once at the gate.")}</p>
            <button onClick={onClose} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{tx("Done")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

const fieldCls = "h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-primary sm:text-sm";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
