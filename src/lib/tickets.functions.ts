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
