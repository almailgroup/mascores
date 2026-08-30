import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ticket as TicketIcon, Loader2, CheckCircle2, Clock, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { QrCode } from "@/components/qr-code";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { claimTicket } from "@/lib/tickets.functions";
import { formatKickoff } from "@/lib/db";
import { useTx } from "@/lib/i18n";

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

function TicketsPage() {
  const tx = useTx();
  const { user } = useAuth();
  const qc = useQueryClient();
  const claim = useServerFn(claimTicket);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "info" | "error"; text: string } | null>(null);

  const offers = useQuery({
    queryKey: ["ticket-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_offers")
        .select("id, match_id, name, stand, price, currency, is_free, capacity, notes, match:match_id(id, kickoff_at, status, venue, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url), competition:competition_id(name, slug, logo_url))")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, code, status, row_label, seat_label, price_paid, currency, used_at, created_at, offer:offer_id(name, stand), match:match_id(kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const buy = async (offer: OfferRow) => {
    if (!user) { setMessage({ tone: "info", text: tx("Sign in to get your ticket.") }); return; }
    setBusy(offer.id); setMessage(null);
    try {
      const res = await claim({ data: { offerId: offer.id, accessCode: code.trim() || undefined } });
      if (res.ok) {
        setMessage({ tone: "ok", text: res.adminCode ? tx("Admin code accepted — free ticket issued.") : tx("Ticket issued. Show the QR code at the gate.") });
        await qc.invalidateQueries({ queryKey: ["my-tickets"] });
      } else if (res.reason === "payment_soon") {
        setMessage({ tone: "info", text: tx("Online payment is coming soon. Use an access code to claim this ticket.") });
      } else if (res.reason === "sold_out") {
        setMessage({ tone: "error", text: tx("This ticket is sold out.") });
      } else {
        setMessage({ tone: "error", text: tx("This ticket is no longer available.") });
      }
    } catch {
      setMessage({ tone: "error", text: tx("Something went wrong. Please try again.") });
    } finally { setBusy(null); }
  };

  const grouped = new Map<string, OfferRow[]>();
  for (const offer of offers.data ?? []) {
    if (!offer.match) continue;
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
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{tx("Pick a match, claim your pass and keep the QR code ready at the gate. Online payment is coming soon.")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={code} onChange={(e) => setCode(e.target.value)} placeholder={tx("Access code (optional)")}
            className="h-10 w-56 rounded-full border border-border bg-background px-4 text-base outline-none focus:border-primary sm:text-sm"
          />
          <span className="text-xs text-muted-foreground">{tx("An access code makes the ticket free.")}</span>
        </div>
        {message && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${message.tone === "ok" ? "bg-primary/10 text-primary" : message.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{message.text}</div>
        )}
      </div>

      {offers.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : grouped.size === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{tx("No tickets on sale right now.")}</div>
      ) : (
        <div className="space-y-3">
          {[...grouped.values()].map((list) => {
            const m = list[0]!.match!;
            return (
              <div key={list[0]!.match_id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
                  {m.competition?.logo_url && <img src={m.competition.logo_url} alt="" className="h-7 w-7 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{tx(m.home?.name ?? "TBD")} <span className="text-muted-foreground">{tx("vs")}</span> {tx(m.away?.name ?? "TBD")}</div>
                    <div className="truncate text-[0.7rem] text-muted-foreground">
                      {[m.competition ? tx(m.competition.name) : null, formatKickoff(m.kickoff_at), m.venue ? tx(m.venue) : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {m.competition && <Link to="/competitions/$slug" params={{ slug: m.competition.slug }} className="shrink-0 text-xs font-semibold text-primary">{tx("Match")}</Link>}
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
                        onClick={() => buy(offer)} disabled={busy === offer.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60"
                      >
                        {busy === offer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : offer.is_free ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {offer.is_free ? tx("Get ticket") : tx("Pay — coming soon")}
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
          {(mine.data ?? []).map((ticket) => {
            const m = ticket.match as unknown as { kickoff_at: string | null; venue: string | null; home: { name: string } | null; away: { name: string } | null; competition: { name: string } | null } | null;
            const offer = ticket.offer as unknown as { name: string; stand: string | null } | null;
            const used = ticket.status === "used";
            return (
              <div key={ticket.id} className={`flex gap-3 overflow-hidden rounded-2xl border p-4 ${used ? "border-border bg-muted/40" : "border-primary/30 bg-card"}`}>
                <QrCode value={ticket.code} size={104} className={used ? "opacity-40" : ""} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{tx(m?.home?.name ?? "TBD")} — {tx(m?.away?.name ?? "TBD")}</div>
                  <div className="truncate text-[0.7rem] text-muted-foreground">{[m?.competition ? tx(m.competition.name) : null, formatKickoff(m?.kickoff_at)].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem] text-muted-foreground">
                    {offer && <span className="font-semibold text-foreground">{tx(offer.name)}</span>}
                    {ticket.row_label && <span>{tx("Row")} {ticket.row_label}</span>}
                    {ticket.seat_label && <span>{tx("Seat")} {ticket.seat_label}</span>}
                    {m?.venue && <span>{tx(m.venue)}</span>}
                  </div>
                  <div className="mt-2 font-mono text-[0.65rem] tracking-wider text-muted-foreground">{ticket.code}</div>
                  <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${used ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {used ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {used ? tx("Scanned") : tx("Valid")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
