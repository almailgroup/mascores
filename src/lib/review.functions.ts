import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { OWNER_EMAIL } from "@/lib/owner.functions";

const TABLES = {
  player: "players",
  team: "teams",
  match: "matches",
  competition_team: "competition_teams",
} as const;

/** Every request waiting for the owner, newest first. */
export const listChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as Record<string, unknown>)?.["email"] ?? "").toLowerCase();
    if (email !== OWNER_EMAIL) return [] as { id: string; entity: string; action: string; label: string; created_at: string; requester_email: string | null }[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_change_requests")
      .select("id,entity,action,label,created_at,requester_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const out = [] as { id: string; entity: string; action: string; label: string; created_at: string; requester_email: string | null }[];
    for (const row of rows) {
      const { data: person } = await supabaseAdmin.auth.admin.getUserById(row.requester_id as string);
      out.push({ ...(row as never as { id: string; entity: string; action: string; label: string; created_at: string }), requester_email: person?.user?.email ?? null });
    }
    return out;
  });

/** The owner says yes (the change is carried out) or no (nothing happens). */
export const decideChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().max(400).nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = String((context.claims as Record<string, unknown>)?.["email"] ?? "").toLowerCase();
    if (email !== OWNER_EMAIL) throw new Error("Owner access only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("admin_change_requests").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("That request is gone.");

    if (data.approve) {
      const table = TABLES[row.entity as keyof typeof TABLES];
      if (row.action === "create") {
        const { error } = await supabaseAdmin.from(table).insert(row.payload as never);
        if (error) throw new Error(error.message);
      } else if (row.target_id) {
        const { error } = await supabaseAdmin.from(table).delete().eq("id", row.target_id);
        if (error) throw new Error(error.message);
      }
    }

    await supabaseAdmin
      .from("admin_change_requests")
      .update({ status: data.approve ? "approved" : "rejected", review_note: data.note ?? null })
      .eq("id", data.id);
    return { ok: true as const };
  });
