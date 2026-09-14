import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // TanStack Start is an SSR app: it needs a server runtime for server functions
  // (admin unlock, AI, chat) to exist at all. Pin the Vercel preset so the build
  // emits .vercel/output instead of the default cloudflare-module bundle.
  nitro: { preset: "vercel" },
  tanstackStart: {
    server: { entry: "server" },
  },
});
