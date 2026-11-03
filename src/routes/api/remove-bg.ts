import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Admin-only: removes a photo's background (transparent) or replaces it with plain white. */
export const Route = createFileRoute("/api/remove-bg")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Sign in first." }, { status: 401 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return Response.json({ error: "Sign in first." }, { status: 401 });
        const { data: isAdmin } = await sb.rpc("is_admin", { _uid: u.user.id });
        if (!isAdmin) return Response.json({ error: "Admins only." }, { status: 403 });

        const body = (await request.json().catch(() => null)) as { imageUrl?: string; mode?: "transparent" | "white" } | null;
        if (!body?.imageUrl || !/^https?:\/\//.test(body.imageUrl)) return Response.json({ error: "No image." }, { status: 400 });
        const white = body.mode === "white";
        const src = await fetch(body.imageUrl);
        if (!src.ok) return Response.json({ error: "Could not read the photo." }, { status: 400 });
        const blob = await src.blob();

        const { cheapImageEdit } = await import("@/lib/cheap-image-edit.server");
        const out = await cheapImageEdit(blob, white
          ? "Keep the person exactly as they are (face, hair, kit, pose, framing unchanged). Replace the entire background with a clean plain pure white (#FFFFFF) studio background."
          : "Keep the person exactly as they are (face, hair, kit, pose, framing unchanged). Replace the entire background with plain pure white (#FFFFFF) so it can be cut out.");
        if (!out.b64) return Response.json({ error: out.error }, { status: out.status });
        return Response.json({ b64: out.b64 });
      },
    },
  },
});
