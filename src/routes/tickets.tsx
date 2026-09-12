import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ticket as TicketIcon, Loader2, CheckCircle2, Clock, ArrowRight, ArrowLeft, X, Sparkles, Minus, Plus, ChevronRight } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { QrCode } from "@/components/qr-code";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { claimTicket, ticketAvailability, listTicketForSale, unlistTicket, listResaleTickets, buyResaleTicket } from "@/lib/tickets.functions";
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

type EventDetails = {
  offer_event_home?: string | null; offer_event_away?: string | null;
  offer_event_competition?: string | null; offer_event_venue?: string | null; offer_event_kickoff_at?: string | null;
};

type OfferRow = {
  id: string; match_id: string | null; name: string; stand: string | null; price: number; currency: string;
  is_free: boolean; capacity: number | null; notes: string | null;
  event_home: string | null; event_away: string | null; event_competition: string | null;
  event_venue: string | null; event_kickoff_at: string | null;
  match: { id: string; kickoff_at: string | null; status: string; venue: string | null;
    home: { name: string; logo_url: string | null } | null;
    away: { name: string; logo_url: string | null } | null;
    competition: { name: string; slug: string; logo_url: string | null } | null } | null;
};

type MyTicket = {
  id: string; code: string; status: string; row_label: string | null; seat_label: string | null;
  holder_name: string | null; price_paid: number; currency: string; used_at: string | null;
  for_sale: boolean; sale_price: number | null; match_id: string | null; is_hidden: boolean;
  offer: { name: string; stand: string | null; event_home: string | null; event_away: string | null;
    event_competition: string | null; event_venue: string | null; event_kickoff_at: string | null } | null;
  match: { kickoff_at: string | null; venue: string | null; home: { name: string } | null; away: { name: string } | null; competition: { name: string } | null } | null;
};

const TICKET_SELECT =
  "id, code, status, row_label, seat_label, holder_name, price_paid, currency, used_at, created_at, for_sale, sale_price, is_hidden, match_id, offer:offer_id(name, stand, event_home, event_away, event_competition, event_venue, event_kickoff_at), match:match_id(kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))";

type EventInfo = { home: string; away: string; competition: string | null; venue: string | null; kickoff: string | null };

/** Details saved on the ticket itself win, so a deleted match never empties a pass. */
function offerEvent(offer: OfferRow): EventInfo {
  return {
    home: offer.event_home || offer.match?.home?.name || "TBD",
    away: offer.event_away || offer.match?.away?.name || "TBD",
    competition: offer.event_competition || offer.match?.competition?.name || null,
    venue: offer.event_venue || offer.match?.venue || null,
    kickoff: offer.event_kickoff_at || offer.match?.kickoff_at || null,
  };
}

function ticketEvent(ticket: MyTicket): EventInfo {
  return {
    home: ticket.offer?.event_home || ticket.match?.home?.name || "TBD",
    away: ticket.offer?.event_away || ticket.match?.away?.name || "TBD",
    competition: ticket.offer?.event_competition || ticket.match?.competition?.name || null,
    venue: ticket.offer?.event_venue || ticket.match?.venue || null,
    kickoff: ticket.offer?.event_kickoff_at || ticket.match?.kickoff_at || null,
  };
}

/** A pass stops working three hours after kickoff. */
function isExpired(kickoff: string | null | undefined): boolean {
  if (!kickoff) return false;
  return Date.now() - new Date(kickoff).getTime() > 3 * 60 * 60 * 1000;
}

/** Reselling closes ten minutes before kickoff — the pass itself stays valid. */
function sellingClosed(kickoff: string | null | undefined): boolean {
  if (!kickoff) return false;
  return Date.now() > new Date(kickoff).getTime() - 10 * 60 * 1000;
}

function TicketsPage() {
  const tx = useTx();
  const { user } = useAuth();
  const [checkout, setCheckout] = useState<OfferRow | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [openTicket, setOpenTicket] = useState<MyTicket | null>(null);
  const availability = useServerFn(ticketAvailability);

  const offers = useQuery({
    queryKey: ["ticket-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_offers")
        .select("id, match_id, name, stand, price, currency, is_free, capacity, notes, event_home, event_away, event_competition, event_venue, event_kickoff_at, match:match_id(id, kickoff_at, status, venue, home:home_team_id(name, logo_url), away:away_team_id(name, logo_url), competition:competition_id(name, slug, logo_url))")
        .eq("is_active", true)
        .eq("approval_status", "approved")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  const offerIds = (offers.data ?? []).map((o) => o.id);
  const left = useQuery({
    enabled: offerIds.length > 0,
    queryKey: ["ticket-availability", offerIds.join(",")],
    queryFn: async () => await availability({ data: { offerIds } }),
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .eq("user_id", user!.id)
        .neq("status", "pool")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as MyTicket[];
    },
  });

  const grouped = new Map<string, OfferRow[]>();
  for (const offer of offers.data ?? []) {
    if (isExpired(offerEvent(offer).kickoff)) continue;
    const key = offer.match_id ?? offer.id;
    const list = grouped.get(key) ?? [];
    list.push(offer);
    grouped.set(key, list);
  }

  return (
    <AppShell>
      <BackButton />
      <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5">
        <div className="flex items-center gap-2 text-primary"><TicketIcon className="h-5 w-5" /><span className="text-[0.7rem] font-bold uppercase tracking-widest">{tx("Tickets")}</span></div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{tx("Match tickets")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{tx("Pick a match, choose how many passes you need and we hand you your codes instantly. Online payment is coming soon.")}</p>
      </div>

      {offers.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : offers.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">{tx("Tickets could not be loaded. Please try again.")}</div>
      ) : grouped.size === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{tx("No tickets on sale right now.")}</div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([key, list]) => {
            const first = list[0]!;
            const info = offerEvent(first);
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
                  {first.match?.competition?.logo_url && <img src={first.match.competition.logo_url} alt="" className="h-7 w-7 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{tx(info.home)} <span className="text-muted-foreground">{tx("vs")}</span> {tx(info.away)}</div>
                    <div className="truncate text-[0.7rem] text-muted-foreground">
                      {[info.competition ? tx(info.competition) : null, formatKickoff(info.kickoff), info.venue ? tx(info.venue) : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {first.match?.competition && <Link to="/competitions/$slug" params={{ slug: first.match.competition.slug }} className="shrink-0 text-xs font-semibold text-primary">{tx("Match")}</Link>}
                </div>
                <div className="divide-y divide-border/70">
                  {list.map((offer) => {
                    const remaining = left.data?.[offer.id] ?? 0;
                    return (
                      <div key={offer.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{tx(offer.name)}{offer.stand ? ` · ${tx(offer.stand)}` : ""}</div>
                          {offer.notes && <div className="truncate text-[0.7rem] text-muted-foreground">{tx(offer.notes)}</div>}
                          <div className={`mt-0.5 text-[0.7rem] font-semibold ${remaining > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {left.isLoading ? tx("Checking availability…") : remaining > 0 ? `${remaining} ${tx("tickets available")}` : tx("Sold out")}
                          </div>
                        </div>
                        <div className="text-sm font-black tabular-nums">{offer.is_free ? tx("Free") : `${offer.price} ${offer.currency}`}</div>
                        <button
                          disabled={remaining === 0}
                          onClick={() => setCheckout(offer)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {offer.is_free ? tx("Get tickets") : tx("Buy tickets")} <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

       <div className="mt-8 mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{tx("My tickets")}</h2>{user && <button onClick={() => setShowHidden(!showHidden)} className="rounded-full border border-border px-3 py-1 text-[0.7rem] font-bold text-muted-foreground">{showHidden ? tx("Show active") : `${tx("Hidden")} (${(mine.data ?? []).filter((ticket) => ticket.is_hidden).length})`}</button>}</div>
      {!user ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {tx("Sign in to see your tickets.")} <Link to="/auth" className="font-semibold text-primary">{tx("Sign in")}</Link>
        </div>
      ) : (mine.data ?? []).filter((ticket) => ticket.is_hidden === showHidden).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{tx("No tickets yet.")}</div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
           {(mine.data ?? []).filter((ticket) => ticket.is_hidden === showHidden).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => setOpenTicket(ticket)} />)}
        </div>
      )}

      <ResaleMarket />

      {openTicket && <TicketSheet ticket={openTicket} onClose={() => setOpenTicket(null)} />}

      {checkout && (
        <CheckoutModal
          offer={checkout}
          remaining={left.data?.[checkout.id] ?? 0}
          onClose={() => { setCheckout(null); void left.refetch(); }}
        />
      )}
    </AppShell>
  );
}

/** Small row: just the match details plus a hint to tap for the pass. */
function TicketRow({ ticket, onOpen }: { ticket: MyTicket; onOpen: () => void }) {
  const tx = useTx();
  const info = ticketEvent(ticket);
  const used = ticket.status === "used";
  const expired = !used && isExpired(info.kickoff);
  return (
    <button onClick={onOpen} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start ${used || expired ? "border-border bg-muted/40" : "border-primary/40 bg-card"}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><TicketIcon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{tx(info.home)} <span className="text-muted-foreground">{tx("vs")}</span> {tx(info.away)}</span>
        <span className="block truncate text-[0.7rem] text-muted-foreground">
          {[info.competition ? tx(info.competition) : null, formatKickoff(info.kickoff), info.venue ? tx(info.venue) : null].filter(Boolean).join(" · ")}
        </span>
        <span className={`mt-0.5 block text-[0.65rem] font-bold ${used || expired ? "text-muted-foreground" : "text-primary"}`}>
          {used ? tx("Scanned") : expired ? tx("Expired") : tx("Click for ticket")}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Full pass with the QR code, opened from a ticket row. */
function TicketSheet({ ticket, onClose }: { ticket: MyTicket; onClose: () => void }) {
  const tx = useTx();
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:max-h-[85dvh] sm:rounded-3xl sm:pb-4 sm:pt-4" onClick={(e) => e.stopPropagation()}>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">{tx("Your ticket")}</h3>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-border" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <TicketCard ticket={ticket} />
      </div>
    </div>
  );
}

/** Professional entry pass: match details on the left, QR stub on the side. */
function TicketCard({ ticket }: { ticket: MyTicket }) {
  const tx = useTx();
  const used = ticket.status === "used";
  const info = ticketEvent(ticket);
  const expired = !used && isExpired(info.kickoff);
  return (
    <div className={`relative flex overflow-hidden rounded-3xl border shadow-sm ${used || expired ? "border-border bg-muted/40" : "border-primary/40 bg-card"}`}>
      {expired && <span className="absolute end-3 top-3 z-10 rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">{tx("Expired")}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-primary/70 px-4 py-2.5 text-primary-foreground">
          <span className="text-[0.65rem] font-black uppercase tracking-[0.2em]">{tx("Entry pass")}</span>
          <span className="text-[0.65rem] font-bold">{ticket.price_paid > 0 ? `${ticket.price_paid} ${ticket.currency}` : tx("Free")}</span>
        </div>
        <div className="p-4">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{info.competition ? tx(info.competition) : tx("Match")}</div>
          <div className="mt-0.5 text-base font-black leading-tight">{tx(info.home)}<span className="text-muted-foreground"> {tx("vs")} </span>{tx(info.away)}</div>
          <div className="mt-1 text-[0.72rem] text-muted-foreground">{formatKickoff(info.kickoff)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem]">
            <Cell label={tx("Ticket")} value={ticket.offer ? tx(ticket.offer.name) : "—"} />
            <Cell label={tx("Stand")} value={ticket.offer?.stand ? tx(ticket.offer.stand) : "—"} />
            <Cell label={tx("Holder")} value={ticket.holder_name || "—"} />
            <Cell label={tx("Venue")} value={info.venue ? tx(info.venue) : "—"} />
            {ticket.row_label && <Cell label={tx("Row")} value={ticket.row_label} />}
            {ticket.seat_label && <Cell label={tx("Seat")} value={ticket.seat_label} />}
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${used ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            {used ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {used ? tx("Scanned") : tx("Valid — scan once at the gate")}
          </div>
          <TicketActions ticket={ticket} />
        </div>
      </div>
      <div className="relative flex w-[122px] shrink-0 flex-col items-center justify-center gap-2 border-s border-dashed border-border bg-muted/30 p-3">
        <QrCode value={ticket.code} size={92} className={used ? "opacity-40" : ""} />
        <div className="text-center font-mono text-[0.58rem] leading-tight tracking-wider text-muted-foreground">{ticket.code}</div>
        <span className="absolute -start-2 -top-2 h-4 w-4 rounded-full bg-background" />
        <span className="absolute -bottom-2 -start-2 h-4 w-4 rounded-full bg-background" />
      </div>
    </div>
  );
}


/** Supporter-to-supporter resale list. Buying issues a fresh QR code. */
function ResaleMarket() {
  const tx = useTx();
  const { user } = useAuth();
  const qc = useQueryClient();
  const load = useServerFn(listResaleTickets);
  const buy = useServerFn(buyResaleTicket);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["resale-tickets"], queryFn: () => load({}) });

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">{tx("Tickets from supporters")}</h2>
      {error && <p className="mb-2 text-xs font-semibold text-destructive">{tx(error)}</p>}
      {list.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{tx("Nobody is reselling a ticket right now.")}</div>
      ) : (
        <div className="space-y-3">
          {(list.data ?? []).map((item) => {
            const offer = item.offer as { name?: string; stand?: string | null; price?: number | null; event_home?: string | null; event_away?: string | null; event_competition?: string | null; event_venue?: string | null; event_kickoff_at?: string | null } | null;
            const home = offer?.event_home || item.match?.home?.name || "TBD";
            const away = offer?.event_away || item.match?.away?.name || "TBD";
            const kickoff = offer?.event_kickoff_at || item.match?.kickoff_at || null;
            const face = Number(offer?.price ?? 0);
            return (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-amber-500/50 bg-amber-500/[0.07]">
                <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{tx(home)} <span className="text-muted-foreground">{tx("vs")}</span> {tx(away)}</div>
                    <div className="truncate text-[0.7rem] text-muted-foreground">
                      {[offer?.name ? tx(offer.name) : null, offer?.stand ? tx(offer.stand) : null, offer?.event_competition ? tx(offer.event_competition) : null, formatKickoff(kickoff)].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 text-[0.7rem] text-muted-foreground">
                      {tx("Original price")}: <span className="font-bold text-foreground">{face > 0 ? `${face} ${item.currency}` : tx("Free")}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{tx("Supporter price")}</div>
                    <div className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-400">{Number(item.sale_price ?? 0)} {item.currency}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-amber-500/10 p-4">
                  <div className="min-w-0 flex-1 text-[0.7rem]">
                    <div className="font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{tx("Contact the seller")}</div>
                    <div className="mt-0.5 break-words font-semibold">{[item.seller_phone, item.seller_email].filter(Boolean).join(" · ") || tx("no contact given")}</div>
                  </div>
                  <button
                    disabled={!user || busy === item.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    onClick={async () => {
                      setBusy(item.id); setError(null);
                      try {
                        await buy({ data: { ticketId: item.id } });
                        await Promise.all([list.refetch(), qc.invalidateQueries({ queryKey: ["my-tickets"] })]);
                      } catch (err) { setError(err instanceof Error ? err.message : "Could not buy this ticket."); }
                      finally { setBusy(null); }
                    }}>
                    {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{user ? tx("Buy") : tx("Sign in to buy")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


/** Sell / stop selling, plus saving the match to the phone's calendar. */
function TicketActions({ ticket }: { ticket: MyTicket }) {
  const tx = useTx();
  const qc = useQueryClient();
  const unlist = useServerFn(unlistTicket);
  const [busy, setBusy] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const info = ticketEvent(ticket);
  const closed = sellingClosed(info.kickoff);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["my-tickets"] });
    await qc.invalidateQueries({ queryKey: ["resale-tickets"] });
  };

  const addToCalendar = () => {
    const start = info.kickoff ? new Date(info.kickoff) : new Date();
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const title = `${info.home} vs ${info.away}`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mansour Almail Scores//Tickets//EN", "BEGIN:VEVENT",
      `UID:${ticket.id}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + 2 * 3600000))}`, `SUMMARY:${title}`,
      `LOCATION:${info.venue ?? ""}`, `DESCRIPTION:Ticket code ${ticket.code}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${ticket.code}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  if (ticket.status !== "valid") return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {ticket.for_sale ? (
        <>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:text-amber-400">{tx("For sale")} · {Number(ticket.sale_price ?? 0)} {ticket.currency}</span>
          <button disabled={busy} className="rounded-full border border-border px-3 py-1 text-[0.7rem] font-bold"
            onClick={async () => { setBusy(true); try { await unlist({ data: { ticketId: ticket.id } }); await refresh(); } finally { setBusy(false); } }}>
            {tx("Stop selling")}
          </button>
        </>
      ) : closed ? (
        <span className="rounded-full border border-dashed border-border px-3 py-1 text-[0.7rem] font-bold text-muted-foreground">
          {tx("Selling closed — your ticket still works at the gate")}
        </span>
      ) : (
        <button className="rounded-full border border-border px-3 py-1 text-[0.7rem] font-bold" onClick={() => setSellOpen(true)}>
          {tx("Sell this ticket")}
        </button>
      )}
      <button className="rounded-full border border-border px-3 py-1 text-[0.7rem] font-bold" onClick={addToCalendar}>{tx("Add to calendar")}</button>
      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[0.7rem] font-bold text-muted-foreground">
        {tx("Add to wallet")} · {tx("Coming soon")}
      </span>
      <button className="rounded-full border border-border px-3 py-1 text-[0.7rem] font-bold text-muted-foreground" onClick={async () => { await supabase.from("tickets").update({ is_hidden: !ticket.is_hidden }).eq("id", ticket.id); await refresh(); }}>{ticket.is_hidden ? tx("Restore") : tx("Hide")}</button>
      {sellOpen && <SellSheet ticket={ticket} onClose={() => setSellOpen(false)} onDone={async () => { setSellOpen(false); await refresh(); }} />}

    </div>
  );
}

/** In-app sheet for listing a pass: price plus the seller's phone and email, all required. */
function SellSheet({ ticket, onClose, onDone }: { ticket: MyTicket; onClose: () => void; onDone: () => void }) {
  const tx = useTx();
  const sell = useServerFn(listTicketForSale);
  const [price, setPrice] = useState(String(ticket.price_paid || 0));
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    if (cleanPhone.length < 6) return setError("Please add a phone number buyers can reach you on.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Please add a valid email address.");
    setBusy(true); setError(null);
    try {
      await sell({ data: { ticketId: ticket.id, price: Number(price) || 0, phone: cleanPhone, email: cleanEmail } });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not list this ticket."); }
    finally { setBusy(false); }
  };

  const field = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black">{tx("Sell this ticket")}</h3>
          <button className="grid h-8 w-8 place-items-center rounded-full border border-border" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{tx("Buyers will see your price and contact details.")}</p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Price")} ({ticket.currency})</span>
            <input className={`mt-1 ${field}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Your phone number")}</span>
            <input className={`mt-1 ${field}`} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+965 ..." />
          </label>
          <label className="block">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Your email")}</span>
            <input className={`mt-1 ${field}`} inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </label>
        </div>
        {error && <p className="mt-3 text-[0.7rem] font-semibold text-destructive">{tx(error)}</p>}
        <button disabled={busy} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50" onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{tx("List for sale")}
        </button>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}

type Step = "quantity" | "details" | "payment" | "issuing" | "done";
type Holder = { name: string; email: string; phone: string };

/** Quantity → holder details (paid only) → payment (coming soon) → codes issued. */
function CheckoutModal({ offer, remaining, onClose }: { offer: OfferRow; remaining: number; onClose: () => void }) {
  const tx = useTx();
  const { user } = useAuth();
  const qc = useQueryClient();
  const claim = useServerFn(claimTicket);
  const [step, setStep] = useState<Step>("quantity");
  const [quantity, setQuantity] = useState(1);
  const [holders, setHolders] = useState<Holder[]>([{ name: "", email: user?.email ?? "", phone: "" }]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<MyTicket[]>([]);
  const max = Math.max(1, Math.min(10, remaining));

  const setQty = (q: number) => {
    const next = Math.max(1, Math.min(max, q));
    setQuantity(next);
    setHolders((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? { name: "", email: user?.email ?? "", phone: "" }));
  };

  const issue = async () => {
    setStep("issuing");
    setError(null);
    try {
      const res = await claim({ data: {
        offerId: offer.id,
        quantity,
        holders: offer.is_free ? undefined : holders.map((h) => ({ name: h.name, email: h.email, phone: h.phone })),
        accessCode: code.trim() || undefined,
        skipPayment: true,
      } });
      if (!res.ok) {
        setError(res.reason === "sold_out" ? tx("There are not enough tickets left.") : tx("This ticket is no longer available."));
        setStep("payment");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
      const { data } = await supabase.from("tickets").select(TICKET_SELECT).in("id", res.ticketIds);
      setIssued((data ?? []) as unknown as MyTicket[]);
      setStep("done");
    } catch {
      setError(tx("Something went wrong. Please try again."));
      setStep("payment");
    }
  };

  return (
    /* Buying takes over the whole page: extra bottom padding keeps the action
       buttons clear of the mobile navigation bar. */
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-background">
      {/* Own back bar, above the site header, so leaving checkout is always tappable. */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-5 py-3">
          <button onClick={onClose} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {tx("Back")}
          </button>
          <span className="ms-auto text-xs font-semibold text-muted-foreground">{tx("Tickets")}</span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-lg px-5 pb-40 pt-5">
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
        ) : step === "quantity" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx("How many tickets?")}</div>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => setQty(quantity - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-border"><Minus className="h-4 w-4" /></button>
                <div className="text-3xl font-black tabular-nums">{quantity}</div>
                <button onClick={() => setQty(quantity + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-border"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 text-center text-xs text-muted-foreground">{remaining} {tx("tickets available")}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3 text-sm font-bold">
              <span>{tx("Total")}</span>
              <span>{offer.is_free ? tx("Free") : `${(Number(offer.price) * quantity).toFixed(2)} ${offer.currency}`}</span>
            </div>
            <button onClick={() => setStep(offer.is_free ? "payment" : "details")}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {tx("Continue")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : step === "details" ? (
          <div className="space-y-4">
            {holders.map((holder, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-border p-4">
                <div className="text-[0.7rem] font-bold uppercase tracking-widest text-primary">{tx("Ticket")} {index + 1} {tx("of")} {quantity}</div>
                <Labeled label={tx("Full name")}>
                  <input value={holder.name} className={fieldCls} placeholder={tx("Full name")}
                    onChange={(e) => setHolders(holders.map((h, i) => (i === index ? { ...h, name: e.target.value } : h)))} />
                </Labeled>
                <Labeled label={tx("Email")}>
                  <input value={holder.email} inputMode="email" className={fieldCls}
                    onChange={(e) => setHolders(holders.map((h, i) => (i === index ? { ...h, email: e.target.value } : h)))} />
                </Labeled>
                <Labeled label={tx("Phone")}>
                  <input value={holder.phone} inputMode="tel" className={fieldCls}
                    onChange={(e) => setHolders(holders.map((h, i) => (i === index ? { ...h, phone: e.target.value } : h)))} />
                </Labeled>
              </div>
            ))}
            <Labeled label={tx("Admin code (optional)")}><input value={code} onChange={(e) => setCode(e.target.value)} className={fieldCls} placeholder="MAMA2026" /></Labeled>
            <button disabled={holders.some((h) => !h.name.trim())} onClick={() => setStep("payment")}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
              {tx("Continue to payment")} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setStep("quantity")} className="h-9 w-full text-xs font-semibold text-muted-foreground">{tx("Back")}</button>
          </div>
        ) : step === "payment" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx("Amount due")}</div>
              <div className="mt-1 text-2xl font-black tabular-nums">{offer.is_free ? tx("Free") : `${(Number(offer.price) * quantity).toFixed(2)} ${offer.currency}`}</div>
              <p className="mt-2 text-xs text-muted-foreground">{tx("Online payment is coming soon. Purchase now and your codes are issued straight away.")}</p>
            </div>
            {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</div>}
            <button disabled className="inline-flex h-11 w-full items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {tx("Pay online — coming soon")}
            </button>
            <button onClick={issue} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {tx("Purchase now")} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setStep(offer.is_free ? "quantity" : "details")} className="h-9 w-full text-xs font-semibold text-muted-foreground">{tx("Back")}</button>
          </div>
        ) : step === "issuing" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <div className="text-sm font-bold">{tx("Please wait for your tickets…")}</div>
            <p className="text-xs text-muted-foreground">{tx("We are assigning your codes.")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" /> {issued.length > 1 ? tx("Your tickets are ready") : tx("Your ticket is ready")}</div>
            {issued.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
            <p className="text-xs text-muted-foreground">{tx("Keep these QR codes — each one can be scanned only once at the gate.")}</p>
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
