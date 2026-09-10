import { createFileRoute } from "@tanstack/react-router";
import { AdminConsole } from "./admin";

export const Route = createFileRoute("/secretadminsafha")({
  head: () => ({
    meta: [
      { title: "Owner — Mansour Almail Scores" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Owner control centre." },
    ],
  }),
  component: () => <AdminConsole owner />,
});
