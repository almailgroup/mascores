import { createFileRoute } from "@tanstack/react-router";
import { AdminConsole } from "./admin";

export const Route = createFileRoute("/secretadminsafha")({
  head: () => ({
    meta: [
      { title: "Owner — Mansour Almail Scores" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Owner control centre." }, { property: "og:title", content: "Owner — Mansour Almail Scores" }, { property: "og:description", content: "Owner control centre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: () => <AdminConsole owner />,
});
