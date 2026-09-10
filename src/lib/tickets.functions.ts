import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { availabilitySchema, claimTicketSchema, scanTicketSchema, ticketPoolSchema } from "./tickets.schemas";

function makeCode(): string {
  return `MAS-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/**
 * Admin-only: tops the offer's code pool up to its capacity. Codes live as
 * unassigned ticket rows and are handed out one by one as fans purchase.
 */
export const generateTicketPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ticketPoolSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: offer } = await supabaseAdmin
      .from("ticket_offers")
      .select("id, match_id, price, currency, is_free")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!offer) throw new Error("Ticket not found.");

    const { count } = await supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offer.id);
    const missing = data.capacity - (count ?? 0);
    if (missing <= 0) return { created: 0, total: count ?? 0 };

    const rows = Array.from({ length: missing }, () => ({
      offer_id: offer.id,
      match_id: offer.match_id,
      user_id: null,
      code: makeCode(),
      price_paid: 0,
      currency: offer.currency,
      status: "pool",
    }));
    const { error } = await supabaseAdmin.from("tickets").insert(rows);
    if (error) throw new Error("Could not generate ticket codes.");
    return { created: missing, total: data.capacity };
  });

/** Public availability counts so fans can see how many passes are left. */
export const ticketAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => availabilitySchema.parse(input))
  .handler(async ({ data }) => {
    if (data.offerIds.length === 0) return {} as Record<string, number>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("tickets")
      .select("offer_id")
      .in("offer_id", data.offerIds)
      .eq("status", "pool")
      .is("user_id", null)
      .limit(20000);
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) if (row.offer_id) counts[row.offer_id] = (counts[row.offer_id] ?? 0) + 1;
    return counts;
  });

/**
 * Hands the requested number of pre-generated codes to the signed-in fan.
 * Free offers need no personal details; paid ones collect one holder per pass.
 */
export const claimTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => claimTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: restricted } = await context.supabase.rpc("is_suspended", { _uid: context.userId });
    if (restricted === true) throw new Error("Your account is restricted, so tickets cannot be issued right now.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offer } = await supabaseAdmin
      .from("ticket_offers")
      .select("id, match_id, price, currency, is_free, is_active")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!offer || !offer.is_active) return { ok: false as const, reason: "unavailable" as const, ticketIds: [] as string[] };

    const adminCodes = [process.env["ADMIN_UNLOCK_PASSWORD"], process.env["ADMIN_UNLOCK_PASSWORD_SECONDARY"]].filter(Boolean) as string[];
    const usedAdminCode = !!data.accessCode && adminCodes.includes(data.accessCode);

    const { data: pool } = await supabaseAdmin
      .from("tickets")
      .select("id")
      .eq("offer_id", offer.id)
      .eq("status", "pool")
      .is("user_id", null)
      .order("created_at", { ascending: true })
      .limit(data.quantity);
    if (!pool || pool.length < data.quantity) return { ok: false as const, reason: "sold_out" as const, ticketIds: [] as string[] };

    const ticketIds: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      const holder = data.holders?.[i];
      const { data: updated } = await supabaseAdmin
        .from("tickets")
        .update({
          user_id: context.userId,
          holder_name: holder?.name?.trim() || null,
          holder_email: holder?.email?.trim() || null,
          holder_phone: holder?.phone?.trim() || null,
          status: "valid",
          price_paid: offer.is_free || usedAdminCode ? 0 : Number(offer.price),
          issued_with_admin_code: usedAdminCode,
        })
        .eq("id", pool[i]!.id)
        .eq("status", "pool")
        .select("id")
        .maybeSingle();
      if (updated) ticketIds.push(updated.id);
    }
    if (ticketIds.length === 0) return { ok: false as const, reason: "sold_out" as const, ticketIds: [] as string[] };
    return { ok: true as const, ticketIds, free: offer.is_free };
  });

/** Admin-only scan: a valid code is accepted once, then marked used. */
export const scanTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scanTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const raw = data.code.trim();
    const code = raw.includes("code=") ? (raw.split("code=")[1] ?? raw).split("&")[0]! : raw;
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, code, status, used_at, holder_name, row_label, seat_label, match_id, offer_id")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (!ticket) return { result: "not_found" as const };
    if (ticket.status === "void") return { result: "void" as const, ticket };
    if (ticket.status === "pool") return { result: "not_sold" as const, ticket };
    if (ticket.status === "used") return { result: "already_used" as const, ticket };

    const { data: updated } = await supabaseAdmin
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .eq("status", "valid")
      .select("id, code, used_at, holder_name, row_label, seat_label, match_id")
      .maybeSingle();
    if (!updated) return { result: "already_used" as const, ticket };
    return { result: "valid" as const, ticket: updated };
  });

/** Owner lists their pass for resale. The admin's price cap on the offer is enforced. */
export const listTicketForSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; price: number; phone?: string; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, user_id, status, offer_id, price_paid, currency")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== context.userId) throw new Error("This is not your ticket.");
    if (ticket.status !== "valid") throw new Error("Only a valid, unused ticket can be sold.");
    const { data: offer } = await supabaseAdmin.from("ticket_offers").select("resale_max_price, price").eq("id", ticket.offer_id ?? "").maybeSingle();
    const cap = offer?.resale_max_price != null ? Number(offer.resale_max_price) : Number(offer?.price ?? ticket.price_paid);
    const price = Math.max(0, Number(data.price) || 0);
    if (cap > 0 && price > cap) throw new Error(`The highest allowed resale price is ${cap} ${ticket.currency}.`);
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ for_sale: true, sale_price: price, seller_phone: data.phone?.trim() || null, seller_email: data.email?.trim() || null })
      .eq("id", ticket.id);
    if (error) throw new Error(error.message);
    return { ok: true, cap };
  });

/** Owner takes their pass off the resale list. */
export const unlistTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ for_sale: false, sale_price: null })
      .eq("id", data.ticketId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Every pass currently offered by supporters, with the seller's contact details. */
export const listResaleTickets = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tickets")
    .select("id, sale_price, currency, row_label, seat_label, seller_phone, seller_email, offer:offer_id(name, stand), match:match_id(kickoff_at, venue, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name))")
    .eq("for_sale", true)
    .eq("status", "valid")
    .order("sale_price", { ascending: true })
    .limit(100);
  return data ?? [];
});

/** Buying a resold pass moves it to the buyer and issues a brand new QR code. */
export const buyResaleTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: restricted } = await context.supabase.rpc("is_suspended", { _uid: context.userId });
    if (restricted === true) throw new Error("Your account is restricted right now.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, user_id, sale_price")
      .eq("id", data.ticketId)
      .eq("for_sale", true)
      .eq("status", "valid")
      .maybeSingle();
    if (!ticket) throw new Error("That ticket is no longer for sale.");
    if (ticket.user_id === context.userId) throw new Error("This ticket is already yours.");
    const { data: updated } = await supabaseAdmin
      .from("tickets")
      .update({
        user_id: context.userId,
        code: makeCode(),
        for_sale: false,
        sale_price: null,
        holder_name: null, holder_email: null, holder_phone: null,
        price_paid: Number(ticket.sale_price ?? 0),
        resold_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .eq("for_sale", true)
      .select("id, code")
      .maybeSingle();
    if (!updated) throw new Error("That ticket was just taken.");
    return { ok: true, code: updated.code };
  });
