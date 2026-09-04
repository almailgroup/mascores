import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchSchema = z.object({ query: z.string().max(120).optional() });
const suspendSchema = z.object({
  userId: z.string().uuid(),
  banned: z.boolean().default(false),
  days: z.number().int().min(0).max(3650).default(0),
  reason: z.string().max(300).optional(),
});
const clearSchema = z.object({ userId: z.string().uuid() });

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Admins only.");
  return supabaseAdmin;
}

export type ModeratedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  banned: boolean;
  suspendedUntil: string | null;
  reason: string | null;
};

/** Admin-only list of accounts with their current ban / suspension state. */
export const listModeratedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ModeratedUser[]> => {
    const admin = await assertAdmin(context.userId);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const users = list?.users ?? [];
    const ids = users.map((user) => user.id);
    const [{ data: profiles }, { data: suspensions }] = await Promise.all([
      admin.from("profiles").select("id, display_name, avatar_url").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("user_suspensions").select("user_id, banned, suspended_until, reason"),
    ]);
    const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
    const suspensionById = new Map((suspensions ?? []).map((row) => [row.user_id, row]));
    const term = (data.query ?? "").trim().toLowerCase();
    return users
      .map((user) => {
        const profile = profileById.get(user.id);
        const suspension = suspensionById.get(user.id);
        return {
          id: user.id,
          email: user.email ?? null,
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          createdAt: user.created_at ?? null,
          banned: !!suspension?.banned,
          suspendedUntil: suspension?.suspended_until ?? null,
          reason: suspension?.reason ?? null,
        };
      })
      .filter((user) => !term || (user.email ?? "").toLowerCase().includes(term) || (user.displayName ?? "").toLowerCase().includes(term))
      .sort((a, b) => (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""));
  });

/** Ban permanently, or suspend for a number of days. */
export const setUserSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => suspendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot suspend your own account.");
    const until = data.banned || data.days === 0 ? null : new Date(Date.now() + data.days * 86400000).toISOString();
    const { error } = await admin.from("user_suspensions").upsert(
      {
        user_id: data.userId,
        banned: data.banned,
        suspended_until: until,
        reason: data.reason?.trim() || null,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lift a ban or suspension. */
export const clearUserSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clearSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const { error } = await admin.from("user_suspensions").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
