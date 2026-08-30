import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimTicketSchema, scanTicketSchema } from "./tickets.schemas";

/**
 * Issues a ticket for the signed-in user. Free offers are issued directly; paid
 * offers require the admin access code until online payment is live.
 */
export const claimTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => claimTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offer } = await supabaseAdmin
      .from("ticket_offers")
      .select("id, match_id, price, currency, is_free, capacity, is_active, show_row, show_seat")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!offer || !offer.is_active) return { ok: false as const, reason: "unavailable" as const };

    const adminCodes = [process.env["ADMIN_UNLOCK_PASSWORD"], process.env["ADMIN_UNLOCK_PASSWORD_SECONDARY"]].filter(Boolean) as string[];
    const usedAdminCode = !!data.accessCode && adminCodes.includes(data.accessCode);
    if (!offer.is_free && !usedAdminCode && !data.skipPayment) return { ok: false as const, reason: "payment_soon" as const };

    if (offer.capacity != null) {
      const { count } = await supabaseAdmin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("offer_id", offer.id)
        .neq("status", "void");
      if ((count ?? 0) >= offer.capacity) return { ok: false as const, reason: "sold_out" as const };
    }

    const code = `MAS-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .insert({
        offer_id: offer.id,
        match_id: offer.match_id,
        user_id: context.userId,
        holder_name: data.holderName?.trim() || null,
        holder_email: data.holderEmail?.trim() || null,
        holder_phone: data.holderPhone?.trim() || null,
        code,
        price_paid: usedAdminCode ? 0 : Number(offer.price),
        currency: offer.currency,
        issued_with_admin_code: usedAdminCode,
      })
      .select("id, code")
      .single();
    if (error) throw new Error("Could not issue the ticket.");
    return { ok: true as const, ticketId: ticket.id, code: ticket.code, free: offer.is_free, adminCode: usedAdminCode };
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
