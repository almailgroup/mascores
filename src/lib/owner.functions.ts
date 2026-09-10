import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** The single owner account that can hand out and take away access. */
export const OWNER_EMAIL = "mansouralmailscores@gmail.com";

export const GRANT_SCOPES = [
  "all", "news", "club_news", "rabta", "tickets", "matches", "voice",
  "teams", "players", "standings", "transfers", "venues", "competitions", "channels", "ai", "chat",
] as const;
export type GrantScope = (typeof GRANT_SCOPES)[number];

async function ownerAdmin(claims: Record<string, unknown> | null | undefined) {
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
  if (email !== OWNER_EMAIL) throw new Error("Owner access only.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * One steady password per account: worked out from the account id, so the owner
 * can look it up again later and it never changes on its own.
 */
async function accountPassword(userId: string) {
  const words = ["Match", "Goal", "Kick", "Score", "Pitch", "Corner", "Assist", "Keeper"];
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mas-access:${userId}`)));
  const word = words[bytes[0]! % words.length];
  const digits = String(100000 + ((bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) % 900000);
  return `${word}-${digits}-Mas`;
}

/** Sends the person a sign-in email so they can get in even without the password. */
async function emailSignInLink(email: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { error } = await client.auth.resetPasswordForEmail(email);
  return !error;
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
  scopes: z.array(z.enum(GRANT_SCOPES)).min(1),
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
    if (!user) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (created.error) throw new Error(created.error.message);
      user = created.data.user;
    }
    if (!user) throw new Error("Could not create that account.");
    // Always the same steady password for this account.
    const password = await accountPassword(user.id);
    const updated = await admin.auth.admin.updateUserById(user.id, { password });
    if (updated.error) throw new Error(updated.error.message);
    if (!user) throw new Error("Could not create that account.");
    const teamId = data.teamId ?? null;
    const { error } = await admin.from("admin_grants").upsert(
      data.scopes.map((scope) => ({
        user_id: user!.id,
        scope,
        // Only club-bound areas keep a club; the rest are site-wide.
        team_id: scope === "club_news" || scope === "rabta" ? teamId : null,
        requires_approval: data.requiresApproval,
        created_by: context.userId,
      })),
      { onConflict: "user_id,scope,team_id" },
    );
    if (error) throw new Error(error.message);
    const emailed = await emailSignInLink(email);
    return { ok: true as const, userId: user.id, password, emailed };
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

/** Makes a one-time password for a managed account, shows it once and emails the person. */
export const resetManagedPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(8).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const password = data.password ?? makePassword();
    const { data: updated, error } = await admin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);
    const emailed = updated.user?.email ? await emailSignInLink(updated.user.email) : false;
    return { ok: true as const, password, emailed };
  });

/** Sends the sign-in email again without changing the one-time password. */
export const resendAccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await ownerAdmin(context.claims as Record<string, unknown>);
    const { data: found, error } = await admin.auth.admin.getUserById(data.userId);
    if (error) throw new Error(error.message);
    const email = found.user?.email;
    if (!email) throw new Error("That account has no email address.");
    const emailed = await emailSignInLink(email);
    return { ok: true as const, emailed };
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
