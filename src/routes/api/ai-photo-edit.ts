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

        const form = new FormData();
        form.append("model", "openai/gpt-image-2.5-sunburst");
        form.append("image", new File([blob], "photo.png", { type: blob.type || "image/png" }));
        form.append("prompt", `This is a football player's portrait photo. Apply this request: "${instruction}". Keep the same person recognisable, the same pose, framing, kit and background unless the request says otherwise. Photorealistic result.`);
        form.append("output_format", "png");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "X-Lovable-AIG-SDK": "fetch" },
          body: form,
        });
        const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string }; message?: string } | null;
        if (!res.ok) {
          const msg = res.status === 402 ? "AI credits have run out." : res.status === 429 ? "Too many requests, try again shortly." : (json?.error?.message ?? json?.message ?? "Photo edit failed.");
          return Response.json({ error: msg }, { status: res.status });
        }
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) return Response.json({ error: "No image returned." }, { status: 502 });
        return Response.json({ b64 });
      },
    },
  },
});
