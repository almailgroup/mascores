import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Admin-only: edits one player photo following a free-text instruction (e.g. "make him bald"). */
export const Route = createFileRoute("/api/ai-photo-edit")({
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

        const body = (await request.json().catch(() => null)) as { imageUrl?: string; instruction?: string } | null;
        const instruction = body?.instruction?.trim().slice(0, 1000);
        if (!body?.imageUrl || !/^https?:\/\//.test(body.imageUrl) || !instruction) return Response.json({ error: "Missing photo or request." }, { status: 400 });
        const src = await fetch(body.imageUrl);
        if (!src.ok) return Response.json({ error: "Could not read the photo." }, { status: 400 });
        const blob = await src.blob();

        const { cheapImageEdit } = await import("@/lib/cheap-image-edit.server");
        const out = await cheapImageEdit(blob, `This is a football player's portrait photo. Apply this request: "${instruction}". Keep the same person recognisable, the same pose, framing, kit and background unless the request says otherwise. Photorealistic result.`);
        if (!out.b64) return Response.json({ error: out.error }, { status: out.status });
        return Response.json({ b64: out.b64 });
      },
    },
  },
});
