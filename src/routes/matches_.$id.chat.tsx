import { createFileRoute } from "@tanstack/react-router";
import { AppShell, BackButton } from "@/components/app-shell";
import { MatchChat } from "@/components/match-chat";
import { useTx } from "@/lib/auto-translate";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/matches_/$id/chat")({
  head: () => ({
    meta: [
      { title: "Match chat — MA Scores" },
      { name: "description", content: "Join the live match chat with other supporters." },
      { property: "og:title", content: "Match chat — MA Scores" },
      { property: "og:description", content: "Join the live match chat with other supporters." },
    ],
  }),
  component: MatchChatPage,
});

function MatchChatPage() {
  const { id } = Route.useParams();
  const tx = useTx();
  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-2xl flex-col px-4 pb-4">
        <div className="flex items-center gap-2 py-3">
          <BackButton iconOnly />
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <MessageCircle className="h-5 w-5 text-primary" /> {tx("Match chat")}
          </h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 [&_.max-h-96]:max-h-none">
          <MatchChat matchId={id} />
        </div>
      </div>
    </AppShell>
  );
}
