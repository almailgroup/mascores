import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://mascores.live";
const STATIC = ["/", "/competitions", "/news", "/transfers", "/tickets", "/support", "/privacypolicy"];

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });
        const urls: string[] = STATIC.map((p) => p);
        const collect = async (table: string, col: string, prefix: string, filter?: (q: any) => any) => {
          const size = 1000;
          for (let offset = 0; ; ) {
            let q: any = supabase.from(table).select(col).order("id").range(offset, offset + size - 1);
            if (filter) q = filter(q);
            const { data, error } = await q;
            if (error) throw error;
            if (!data.length) break;
            for (const r of data) if (r[col]) urls.push(`${prefix}/${encodeURIComponent(String(r[col]))}`);
            offset += data.length;
          }
        };
        await collect("competitions", "slug", "/competitions");
        await collect("teams", "id", "/teams");
        await collect("matches", "id", "/matches");
        await collect("players", "id", "/players");
        await collect("news_posts", "slug", "/news", (q) => q.not("published_at", "is", null).lte("published_at", new Date().toISOString()));
        const body = [...new Set(urls)].map((p) => `<url><loc>${esc(BASE_URL + p)}</loc></url>`).join("");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
