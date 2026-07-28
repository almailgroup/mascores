import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState } from "@/components/app-shell";
import { supabase } from "@/lib/db";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const res = useQuery({
    enabled: q.length > 1,
    queryKey: ["search", q],
    queryFn: async () => {
      const term = `%${q}%`;
      const [teams, players, comps] = await Promise.all([
        supabase.from("teams").select("id,name,country,logo_url").ilike("name", term).limit(10),
        supabase.from("players").select("id,name,position").ilike("name", term).limit(10),
        supabase.from("competitions").select("id,slug,name,country").ilike("name", term).limit(10),
      ]);
      return { teams: teams.data ?? [], players: players.data ?? [], comps: comps.data ?? [] };
    },
  });
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Teams, players, competitions…"
          className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      {q.length < 2 ? <EmptyState title="Type to search" /> : !res.data ? null : (
        <div className="space-y-6">
          <Group title="Competitions">{res.data.comps.map((c) => (
            <Link key={c.id} to="/competitions/$slug" params={{ slug: c.slug }} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/50">
              <div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.country}</div>
            </Link>))}</Group>
          <Group title="Teams">{res.data.teams.map((tm) => (
            <Link key={tm.id} to="/teams/$id" params={{ id: tm.id }} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/50">
              <div className="font-medium">{tm.name}</div><div className="text-xs text-muted-foreground">{tm.country}</div>
            </Link>))}</Group>
          <Group title="Players">{res.data.players.map((p) => (
            <Link key={p.id} to="/players/$id" params={{ id: p.id }} className="block rounded-xl border border-border bg-card p-3 hover:border-primary/50">
              <div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.position}</div>
            </Link>))}</Group>
        </div>
      )}
    </AppShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}