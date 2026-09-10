import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** The single owner account that can hand out and take away access. */
export const OWNER_EMAIL = "mansouralmailscores@gmail.com";

export const GRANT_SCOPES = ["all", "news", "club_news", "rabta", "tickets", "matches", "voice"] as const;
export type GrantScope = (typeof GRANT_SCOPES)[number];

async function ownerAdmin(claims: Record<string, unknown> | null | undefined) {
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
  if (email !== OWNER_EMAIL) throw new Error("Owner access only.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Readable one-off password we show the owner once so they can pass it on. */
function makePassword() {
  const words = ["Match", "Goal", "Kick", "Score", "Pitch", "Corner", "Assist", "Keeper"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}-${digits}-MAS`;
}

export type ManagedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  grants: { id: string; scope: GrantScope; teamId: string | null; teamName: string | null; requiresApproval: boolean }[];
};

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const [{ data: grants }, { data: profiles }, { data: teams }] = await Promise.all([
      admin.from("admin_grants").select("id,user_id,scope,team_id,requires_approval"),
      admin.from("profiles").select("id,display_name"),
      admin.from("teams").select("id,name"),
    ]);
    const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
    const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      displayName: name.get(u.id) ?? null,
      grants: (grants ?? [])
        .filter((g) => g.user_id === u.id)
        .map((g) => ({
          id: g.id,
          scope: g.scope as GrantScope,
          teamId: g.team_id,
          teamName: g.team_id ? teamName.get(g.team_id) ?? null : null,
          requiresApproval: g.requires_approval,
        })),
    }));
  });

const grantSchema = z.object({
  email: z.string().email(),
  scope: z.enum(GRANT_SCOPES),
  teamId: z.string().uuid().nullish(),
  requiresApproval: z.boolean().default(true),
});

/** Creates the account if it does not exist yet and gives it one scope of access. */
export const addManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const email = data.email.trim().toLowerCase();
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = existing?.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
    let password: string | null = null;
    if (!user) {
      password = makePassword();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw new Error(created.error.message);
      user = created.data.user;
    }
    if (!user) throw new Error("Could not create that account.");
    const { error } = await admin.from("admin_grants").upsert(
      {
        user_id: user.id,
        scope: data.scope,
        team_id: data.teamId ?? null,
        requires_approval: data.requiresApproval,
        created_by: context.userId,
      },
      { onConflict: "user_id,scope,team_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, userId: user.id, password };
  });

export const removeManagedGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const { error } = await admin.from("admin_grants").delete().eq("id", data.grantId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setGrantApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grantId: z.string().uuid(), requiresApproval: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const { error } = await admin.from("admin_grants").update({ requires_approval: data.requiresApproval }).eq("id", data.grantId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Makes a new password for a managed account and shows it to the owner once. */
export const resetManagedPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(8).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const password = data.password ?? makePassword();
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);
    return { ok: true as const, password };
  });

/** Signs every other account out of every device. The owner's own session stays. */
export const signOutEveryoneElse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw new Error(error.message);
    let count = 0;
    for (const user of users.users) {
      if (user.id === context.userId) continue;
      const res = await admin.auth.admin.signOut(user.id, "global").catch(() => null);
      if (!res?.error) count += 1;
    }
    return { ok: true as const, count };
  });

/** Tells the browser what the signed-in account may reach. */
export const myAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as Record<string, unknown>;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
    const isOwner = email === OWNER_EMAIL;
    const { data } = await context.supabase.from("admin_grants").select("scope,team_id,requires_approval");
    return {
      isOwner,
      grants: (data ?? []).map((g) => ({ scope: g.scope as GrantScope, teamId: g.team_id, requiresApproval: g.requires_approval })),
    };
  });
