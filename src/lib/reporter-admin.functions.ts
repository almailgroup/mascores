import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { OWNER_EMAIL } from "@/lib/owner.functions";

/**
 * Turning someone down removes their reporter account completely, together with
 * anything they had sent in, so nothing is left waiting in the desk.
 */
export const deleteReporter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const email = String((context.claims as Record<string, unknown>)?.["email"] ?? "").toLowerCase();
    if (email !== OWNER_EMAIL) throw new Error("Owner access only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("news_reporters").select("user_id").eq("id", data.id).maybeSingle();
    if (row?.user_id) {
      await supabaseAdmin.from("news_submissions").delete().eq("author_id", row.user_id);
    }
    const { error } = await supabaseAdmin.from("news_reporters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
