import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, QrCode as QrIcon, Ticket, Camera, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QrCode } from "@/components/qr-code";
import { generateTicketPool, scanTicket } from "@/lib/tickets.functions";
import { formatKickoff } from "@/lib/db";
import { Field, inputCls, btnPrimary, btnGhost, btnDanger, Modal } from "./ui";
import { ConfirmDelete } from "@/components/confirm-delete";

type MatchOption = {
  id: string; kickoff_at: string | null; venue: string | null;
  home: { name: string } | null; away: { name: string } | null; competition: { name: string } | null;
};

type Offer = {
  id: string; match_id: string | null; name: string; stand: string | null; price: number; currency: string; resale_max_price: number | null;
  is_free: boolean; capacity: number | null; show_row: boolean; show_seat: boolean; notes: string | null; is_active: boolean;
  approval_status?: string | null;
  event_home?: string | null; event_away?: string | null; event_competition?: string | null;
  event_venue?: string | null; event_kickoff_at?: string | null;
};

const emptyOffer = {
  name: "General admission", stand: "", price: "3", currency: "KWD", is_free: false, resale_max_price: "",
  capacity: "100", show_row: true, show_seat: true, notes: "", is_active: true,
  event_home: "", event_away: "", event_competition: "", event_venue: "", event_kickoff: "",
};

/** ISO timestamp ⇄ the value an <input type="datetime-local"> expects. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** What this ticket is for, taken from its own saved details first. */
export function offerEventLabel(offer: Offer): string {
  const teams = [offer.event_home, offer.event_away].filter(Boolean).join(" vs ");
  return [teams || null, offer.event_competition, offer.event_kickoff_at ? formatKickoff(offer.event_kickoff_at) : null, offer.event_venue]
    .filter(Boolean).join(" · ");
}



/**
 * Admin ticketing: create ticket types per match, issue passes and scan QR codes.
 * When the owner asked for approval, new tickets are held back until he says yes.
 */
export function TicketsPanel({ needsApproval = false }: { needsApproval?: boolean }) {
  const [view, setView] = useState<"offers" | "sellers" | "scan">("offers");
  const label = { offers: "Tickets", sellers: "Sellers", scan: "Scan QR code" } as const;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["offers", "sellers", "scan"] as const).map((k) => (
          <button key={k} onClick={() => setView(k)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold ${view === k ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>
            {k === "offers" ? <Ticket className="h-3.5 w-3.5" /> : k === "sellers" ? <Users className="h-3.5 w-3.5" /> : <QrIcon className="h-3.5 w-3.5" />}
            {label[k]}
          </button>
        ))}
      </div>
      {view === "offers" ? <OffersView needsApproval={needsApproval} /> : view === "sellers" ? <SellersView /> : <ScanView />}
    </div>
  );
}

/** Everyone reselling a pass right now, with the phone and email they gave buyers. */
function SellersView() {
  const sellers = useQuery({
    queryKey: ["admin-ticket-sellers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, code, sale_price, currency, seller_phone, seller_email, holder_name, row_label, seat_label, updated_at, offer:offer_id(name, stand), match:match_id(kickoff_at, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))")
        .eq("for_sale", true)
        .eq("status", "valid")
        .order("updated_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  if (sellers.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if ((sellers.data ?? []).length === 0) return <p className="text-sm text-muted-foreground">Nobody is reselling a ticket right now.</p>;
  return (
    <div className="space-y-2">
      {(sellers.data ?? []).map((row) => {
        const match = row.match as { kickoff_at?: string | null; home?: { name?: string } | null; away?: { name?: string } | null; competition?: { name?: string } | null } | null;
        const offer = row.offer as { name?: string; stand?: string | null } | null;
        return (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{match?.home?.name ?? "TBD"} vs {match?.away?.name ?? "TBD"}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold text-primary">{Number(row.sale_price ?? 0)} {row.currency}</span>
              <span className="font-mono tracking-wider text-muted-foreground">{row.code}</span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {[offer?.name, offer?.stand, match?.competition?.name, match?.kickoff_at ? formatKickoff(match.kickoff_at) : null].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 font-semibold">
              {[row.seller_phone, row.seller_email].filter(Boolean).join(" · ") || "No contact details"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OffersView({ needsApproval }: { needsApproval: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyOffer });
  const [editing, setEditing] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOffer, setDeleteOffer] = useState<Offer | null>(null);
  const [issueOffer, setIssueOffer] = useState<Offer | null>(null);
  const [buyersOffer, setBuyersOffer] = useState<Offer | null>(null);
  const makePool = useServerFn(generateTicketPool);

  const counts = useQuery({
    queryKey: ["admin-ticket-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("offer_id, status").limit(20000);
      const map: Record<string, { pool: number; sold: number }> = {};
      for (const row of data ?? []) {
        if (!row.offer_id) continue;
        const entry = (map[row.offer_id] ??= { pool: 0, sold: 0 });
        if (row.status === "pool") entry.pool += 1; else entry.sold += 1;
      }
      return map;
    },
  });


  const matches = useQuery({
    queryKey: ["admin-ticket-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name)")
        .order("kickoff_at", { ascending: true })
        .limit(400);
      return (data ?? []) as unknown as MatchOption[];
    },
  });

  const offers = useQuery({
    queryKey: ["admin-ticket-offers"],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_offers").select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Offer[];
    },
  });

  const label = (m: MatchOption) => `${m.home?.name ?? "TBD"} vs ${m.away?.name ?? "TBD"} — ${m.competition?.name ?? ""} ${formatKickoff(m.kickoff_at)}`;
  const filtered = (matches.data ?? []).filter((m) => label(m).toLowerCase().includes(search.trim().toLowerCase()));

  /** Picking a match copies its details in; they are then editable and kept forever. */
  const pickMatch = (id: string | null) => {
    setMatchId(id);
    const m = (matches.data ?? []).find((item) => item.id === id);
    if (!m) return;
    setForm((prev) => ({
      ...prev,
      event_home: m.home?.name ?? "",
      event_away: m.away?.name ?? "",
      event_competition: m.competition?.name ?? "",
      event_venue: m.venue ?? "",
      event_kickoff: toLocalInput(m.kickoff_at),
    }));
  };

  const save = async () => {
    if (!form.event_home.trim() && !matchId && !editing) return;
    const capacity = Number(form.capacity);
    if (!Number.isFinite(capacity) || capacity < 1) return;
    setBusy(true);
    const payload = {
      match_id: editing ? editing.match_id : matchId,
      event_home: form.event_home.trim() || null,
      event_away: form.event_away.trim() || null,
      event_competition: form.event_competition.trim() || null,
      event_venue: form.event_venue.trim() || null,
      event_kickoff_at: fromLocalInput(form.event_kickoff),

      name: form.name.trim() || "General admission",
      stand: form.stand.trim() || null,
      price: form.is_free ? 0 : Number(form.price || 0),
      resale_max_price: form.resale_max_price ? Number(form.resale_max_price) : null,
      currency: form.currency.trim() || "KWD",
      is_free: form.is_free,
      capacity,
      show_row: form.show_row,
      show_seat: form.show_seat,
      notes: form.notes.trim() || null,
      // A ticket that still needs a yes never goes on sale on its own.
      is_active: needsApproval ? false : form.is_active,
      approval_status: needsApproval ? "pending" : "approved",
    };
    let offerId = editing?.id ?? null;
    if (editing) await supabase.from("ticket_offers").update(payload).eq("id", editing.id);
    else {
      const { data: me } = await supabase.auth.getUser();
      const { data } = await supabase.from("ticket_offers").insert({ ...payload, created_by: me.user?.id ?? null }).select("id").maybeSingle();
      offerId = data?.id ?? null;
    }
    if (offerId) {
      try { await makePool({ data: { offerId, capacity } }); }
      catch { /* codes can be topped up again by saving the ticket */ }
    }
    await qc.invalidateQueries({ queryKey: ["admin-ticket-offers"] });
    await qc.invalidateQueries({ queryKey: ["admin-ticket-counts"] });
    setForm({ ...emptyOffer });
    setEditing(null);

    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">{editing ? "Edit ticket" : "New ticket"}</h3>
        {!editing && (
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inputCls} ps-8`} placeholder="Search matches…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Field label="Match">
              <select className={inputCls} value={matchId ?? ""} onChange={(e) => setMatchId(e.target.value || null)}>
                <option value="">Select a match…</option>
                {filtered.slice(0, 120).map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Ticket name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Stand / section"><input className={inputCls} value={form.stand} onChange={(e) => setForm({ ...form, stand: e.target.value })} placeholder="West stand" /></Field>
          <Field label="Price"><input className={inputCls} inputMode="decimal" disabled={form.is_free} value={form.is_free ? "0" : form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Currency"><input className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          <Field label="Capacity (required)"><input className={inputCls} inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="100" /></Field>
          <Field label="Max resale price (optional)"><input className={inputCls} inputMode="decimal" value={form.resale_max_price} onChange={(e) => setForm({ ...form, resale_max_price: e.target.value })} placeholder="Same as price" /></Field>
          <Field label="Note (optional)"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Gate A opens 2h before" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
          {([["is_free", "Free ticket"], ["show_row", "Print row number"], ["show_seat", "Print seat number"], ["is_active", "On sale"]] as const).map(([key, text]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
              {text}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Saving generates one unique QR code per capacity slot. Fans receive codes from this pool when they purchase.</p>
        {needsApproval && (
          <p className="mt-1 text-xs font-semibold text-amber-600">This ticket is sent to the site owner first. It only goes on sale once he approves it.</p>
        )}
        <div className="mt-4 flex gap-2">
          <button className={btnPrimary} disabled={busy || (!editing && !matchId) || !form.capacity.trim()} onClick={save}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editing ? "Save ticket" : "Create ticket & codes"}
          </button>
          {editing && <button className={btnGhost} onClick={() => { setEditing(null); setForm({ ...emptyOffer }); }}>Cancel</button>}
        </div>

      </div>

      <div className="space-y-2">
        {offers.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {(offers.data ?? []).map((offer) => {
          const m = (matches.data ?? []).find((item) => item.id === offer.match_id);
          return (
            <div key={offer.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{offer.name}{offer.stand ? ` · ${offer.stand}` : ""} <span className="text-muted-foreground">{offer.is_free ? "· Free" : `· ${offer.price} ${offer.currency}`}</span></div>
                <div className="truncate text-[0.7rem] text-muted-foreground">{m ? label(m) : offer.match_id}</div>
                <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                  {[
                    offer.approval_status === "pending" ? "Waiting for approval" : offer.approval_status === "rejected" ? "Turned down" : offer.is_active ? "On sale" : "Hidden",
                    `${counts.data?.[offer.id]?.pool ?? 0} codes left`,
                    `${counts.data?.[offer.id]?.sold ?? 0} sold`,
                    offer.capacity ? `capacity ${offer.capacity}` : null,
                  ].filter(Boolean).join(" · ")}
                </div>

              </div>
              <button className={btnGhost} onClick={() => setIssueOffer(offer)}><QrIcon className="h-3.5 w-3.5" /> Passes</button>
              <button className={btnGhost} onClick={async () => { await supabase.from("ticket_offers").update({ is_active: !offer.is_active }).eq("id", offer.id); await qc.invalidateQueries({ queryKey: ["admin-ticket-offers"] }); }}>{offer.is_active ? "Hide" : "Show"}</button>
              <button className={btnGhost} onClick={() => setBuyersOffer(offer)}>Buyers</button>
              <button className={btnGhost} onClick={() => { setEditing(offer); setForm({ name: offer.name, stand: offer.stand ?? "", price: String(offer.price), currency: offer.currency, is_free: offer.is_free, capacity: offer.capacity ? String(offer.capacity) : "", show_row: offer.show_row, show_seat: offer.show_seat, notes: offer.notes ?? "", is_active: offer.is_active, resale_max_price: offer.resale_max_price != null ? String(offer.resale_max_price) : "" }); }}>Edit</button>
              <button className={btnDanger} onClick={() => setDeleteOffer(offer)}>Delete</button>
            </div>
          );
        })}
        {!offers.isLoading && (offers.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tickets created yet.</p>}
      </div>

      <ConfirmDelete
        open={!!deleteOffer}
        title={`Delete ${deleteOffer?.name ?? "ticket"}`}
        description="This removes the ticket type. Passes already issued from it stay valid but lose their ticket details."
        confirmWord="DELETE"
        actionLabel="Delete ticket"
        onCancel={() => setDeleteOffer(null)}
        onConfirm={async () => { await supabase.from("ticket_offers").delete().eq("id", deleteOffer!.id); setDeleteOffer(null); await qc.invalidateQueries({ queryKey: ["admin-ticket-offers"] }); }}
      />
      {issueOffer && <PassesModal offer={issueOffer} onClose={() => setIssueOffer(null)} />}
      {buyersOffer && <BuyersModal offer={buyersOffer} onClose={() => setBuyersOffer(null)} />}
    </div>
  );
}

type TicketRow = {
  id: string; code: string; status: string; holder_name: string | null; row_label: string | null;
  seat_label: string | null; used_at: string | null; issued_with_admin_code: boolean; created_at: string;
};

function PassesModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const qc = useQueryClient();
  const [holder, setHolder] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [busy, setBusy] = useState(false);

  const tickets = useQuery({
    queryKey: ["admin-tickets", offer.id],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id, code, status, holder_name, row_label, seat_label, used_at, issued_with_admin_code, created_at").eq("offer_id", offer.id).order("created_at", { ascending: false });
      return (data ?? []) as TicketRow[];
    },
  });

  const issue = async () => {
    setBusy(true);
    const code = `MAS-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    await supabase.from("tickets").insert({
      offer_id: offer.id, match_id: offer.match_id, code,
      holder_name: holder.trim() || null,
      row_label: offer.show_row ? (row.trim() || null) : null,
      seat_label: offer.show_seat ? (seat.trim() || null) : null,
      price_paid: offer.is_free ? 0 : offer.price, currency: offer.currency,
      issued_with_admin_code: true,
    });
    setHolder(""); setRow(""); setSeat("");
    await qc.invalidateQueries({ queryKey: ["admin-tickets", offer.id] });
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} title={`${offer.name} passes`} wide>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Holder (optional)"><input className={inputCls} value={holder} onChange={(e) => setHolder(e.target.value)} /></Field>
        {offer.show_row && <Field label="Row"><input className={inputCls} value={row} onChange={(e) => setRow(e.target.value)} /></Field>}
        {offer.show_seat && <Field label="Seat"><input className={inputCls} value={seat} onChange={(e) => setSeat(e.target.value)} /></Field>}
        <div className="flex items-end"><button className={btnPrimary} disabled={busy} onClick={issue}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Generate pass</button></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(tickets.data ?? []).map((ticket) => (
          <div key={ticket.id} className="flex gap-3 rounded-2xl border border-border p-3">
            <QrCode value={ticket.code} size={92} className={ticket.status === "used" ? "opacity-40" : ""} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{ticket.holder_name ?? "Open pass"}</div>
              <div className="text-[0.65rem] text-muted-foreground">{[ticket.row_label ? `Row ${ticket.row_label}` : null, ticket.seat_label ? `Seat ${ticket.seat_label}` : null].filter(Boolean).join(" · ") || "No seat assigned"}</div>
              <div className="mt-1 font-mono text-[0.65rem] tracking-wider">{ticket.code}</div>
              <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${ticket.status === "used" ? "bg-muted text-muted-foreground" : ticket.status === "void" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{ticket.status}</div>
              <div className="mt-2 flex gap-2">
                {ticket.status !== "valid" && <button className="text-[0.65rem] font-semibold text-primary" onClick={async () => { await supabase.from("tickets").update({ status: "valid", used_at: null }).eq("id", ticket.id); await qc.invalidateQueries({ queryKey: ["admin-tickets", offer.id] }); }}>Reactivate</button>}
                <button className="text-[0.65rem] font-semibold text-destructive" onClick={async () => { await supabase.from("tickets").delete().eq("id", ticket.id); await qc.invalidateQueries({ queryKey: ["admin-tickets", offer.id] }); }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {(tickets.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No passes generated yet.</p>}
      </div>
    </Modal>
  );
}

/** Who bought passes for this ticket, with the contact details they entered. */
function BuyersModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const buyers = useQuery({
    queryKey: ["admin-ticket-buyers", offer.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, code, status, holder_name, holder_email, holder_phone, price_paid, currency, created_at, used_at")
        .eq("offer_id", offer.id)
        .neq("status", "pool")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Modal open onClose={onClose} title={`${offer.name} buyers`} wide>
      {buyers.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (buyers.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has bought this ticket yet.</p>
      ) : (
        <div className="space-y-2">
          {(buyers.data ?? []).map((row) => (
            <div key={row.id} className="rounded-xl border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{row.holder_name ?? "No name given"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${row.status === "used" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{row.status}</span>
                <span className="font-mono tracking-wider text-muted-foreground">{row.code}</span>
              </div>
              <div className="mt-1 text-muted-foreground">
                {[row.holder_email, row.holder_phone, `${row.price_paid} ${row.currency}`, new Date(row.created_at).toLocaleString()].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ScanView() {
  const scan = useServerFn(scanTicket);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ result: string; ticket?: { code: string; holder_name: string | null; row_label: string | null; seat_label: string | null } } | null>(null);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const busyRef = useRef(false);

  const check = async (value: string) => {
    if (!value.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { setResult(await scan({ data: { code: value.trim() } }) as typeof result); }
    catch { setResult({ result: "error" }); }
    finally { busyRef.current = false; setBusy(false); }
  };

  // Live QR scanning with jsQR, so any phone or laptop camera works.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");

    (async () => {
      const jsQR = (await import("jsqr")).default;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch { setCamera(false); setResult({ result: "no_camera" }); return; }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const tick = () => {
        if (stopped) return;
        const v = videoRef.current;
        if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx && canvas.width && canvas.height) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              stopped = true;
              setCamera(false);
              void check(found.data);
              return;
            }
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = result?.result === "valid" ? "bg-primary/10 text-primary" : result?.result === "already_used" || result?.result === "void" || result?.result === "not_found" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  const text: Record<string, string> = {
    valid: "Valid ticket — entry allowed. This code is now used.",
    already_used: "Already scanned — this code is no longer valid.",
    void: "This ticket was cancelled.",
    not_sold: "This code has not been purchased yet.",
    not_found: "Unknown code — no ticket matches this QR.",
    no_camera: "Camera access was blocked. Allow the camera or type the code instead.",
    error: "Scan failed. Please try again.",
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Scan a ticket</h3>
        <p className="mt-1 text-xs text-muted-foreground">Point the camera at the fan's QR code — it reads automatically. Each code works once.</p>
        <button className={`${btnPrimary} mt-3`} onClick={() => { setResult(null); setCamera((v) => !v); }}>
          <Camera className="h-3.5 w-3.5" /> {camera ? "Stop scanner" : "Start QR scanner"}
        </button>
        {camera && (
          <div className="relative mt-3 overflow-hidden rounded-xl bg-foreground/80">
            <video ref={videoRef} muted playsInline autoPlay className="aspect-[3/4] w-full object-cover sm:aspect-video" />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary/80" />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="Or type MAS-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void check(code); }} />
          <button className={btnGhost} disabled={busy} onClick={() => check(code)}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check"}</button>
        </div>
      </div>
      {result && (
        <div className={`rounded-2xl p-4 ${tone}`}>
          <div className="text-sm font-bold">{text[result.result] ?? result.result}</div>
          {result.ticket && (
            <div className="mt-1 text-xs">
              <span className="font-mono">{result.ticket.code}</span>
              {result.ticket.holder_name ? ` \u00b7 ${result.ticket.holder_name}` : ""}
              {result.ticket.row_label ? ` \u00b7 Row ${result.ticket.row_label}` : ""}
              {result.ticket.seat_label ? ` \u00b7 Seat ${result.ticket.seat_label}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
