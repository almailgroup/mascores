import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, STATUS_LABELS, roundLabel, type Match, type Team, type MatchEvent, type Lineup, type Player } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle, PlayCircle, Radio } from "lucide-react";

export const Route = createFileRoute("/matches/$id")({
  head: ({ params }) => ({ meta: [{ title: `Match — MansourAlmailScores` }, { name: "description", content: `Match center ${params.id}` }] }),
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<"details" | "lineups" | "stats" | "previous" | "media">("details");
  const [chatBody, setChatBody] = useState("");
  useRealtime(["matches", "match_events", "match_lineups", "player_ratings", "match_stats", "match_chat_messages", "media_items"]);
  const m = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), competition:competition_id(id,name,slug,country,country_code)")
        .eq("id", id).maybeSingle();
      return data as (Match & { home: Team | null; away: Team | null; competition: { id: string; name: string; slug: string; country: string | null; country_code: string | null } | null }) | null;
    },
  });
  const events = useQuery({
    queryKey: ["match-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events")
        .select("*, player:player_id(id,name), team:team_id(id,name)")
        .eq("match_id", id).order("minute").order("extra");
      return (data ?? []) as unknown as (MatchEvent & { player: Player | null; team: Team | null })[];
    },
  });
  const lineups = useQuery({
    queryKey: ["match-lineups", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups")
        .select("*, player:player_id(id,name,shirt_number,position,photo_url)")
        .eq("match_id", id);
      return (data ?? []) as unknown as (Lineup & { player: Player | null })[];
    },
  });
  const stats = useQuery({ queryKey: ["match-stats", id], queryFn: async () => (await supabase.from("match_stats").select("*").eq("match_id", id).order("sort_order")).data ?? [] });
  const prediction = useQuery({ queryKey: ["match-prediction", id], queryFn: async () => (await supabase.from("match_predictions").select("*").eq("match_id", id).maybeSingle()).data });
  const broadcasts = useQuery({ queryKey: ["match-broadcasts", id], queryFn: async () => (await supabase.from("match_broadcasts").select("channel:broadcast_channels(id,name,logo_url,country_code)").eq("match_id", id)).data ?? [] });
  const media = useQuery({ queryKey: ["match-media", id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "match").eq("owner_id", id).order("sort_order")).data ?? [] });
  const chat = useQuery({ queryKey: ["match-chat", id], queryFn: async () => (await supabase.from("match_chat_messages").select("*").eq("match_id", id).order("created_at").limit(100)).data ?? [] });
  const ratings = useQuery({ queryKey: ["match-ratings", id], queryFn: async () => (await supabase.from("player_ratings").select("player_id,rating").eq("match_id", id)).data ?? [] });

  if (m.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!m.data) return <AppShell><EmptyState title="Match not found" /></AppShell>;
  const match = m.data;
  const isLive = ["live", "ht"].includes(match.status);

  return (
    <AppShell>
      <div className="mb-6 rounded-3xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{match.competition?.name}{roundLabel(match.round_number, match.round) ? ` · ${roundLabel(match.round_number, match.round)}` : ""}</div>
        <div className="mt-4 grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="text-right">
            {match.home?.logo_url && <img src={match.home.logo_url} className="ml-auto h-14 w-14 object-contain" alt="" />}
            <div className="mt-2 text-lg font-bold">{match.home?.name ?? "TBD"}</div>
          </div>
          <div className="text-center">
            {["scheduled"].includes(match.status) ? (
              <div className="text-sm font-medium text-muted-foreground">{formatKickoff(match.kickoff_at)}</div>
            ) : (
              <div>
                <div className="text-4xl font-black tabular-nums">{match.home_score ?? 0} – {match.away_score ?? 0}</div>
                {match.status === "pen" && match.home_pen != null && match.away_pen != null && (
                  <div className="text-xs text-muted-foreground">({match.home_pen}–{match.away_pen} pens)</div>
                )}
              </div>
            )}
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
              {STATUS_LABELS[match.status] ?? match.status}
              {match.status === "live" && match.live_minute ? ` · ${match.live_minute}'` : ""}
            </div>
          </div>
          <div>
            {match.away?.logo_url && <img src={match.away.logo_url} className="h-14 w-14 object-contain" alt="" />}
            <div className="mt-2 text-lg font-bold">{match.away?.name ?? "TBD"}</div>
          </div>
        </div>
        {match.venue && <div className="mt-4 text-center text-xs text-muted-foreground">{match.venue}{match.city ? ` · ${match.city}` : ""}</div>}
      </div>

      <div className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-sm">
        {(["details", "lineups", "stats", "previous", "media"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 px-4 py-2 font-semibold capitalize ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{item === "media" ? "Media & chat" : item}</button>)}
      </div>

      {tab === "details" && <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Timeline</div>
          {events.data && events.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {events.data.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{e.minute ?? "-"}{e.extra ? `+${e.extra}` : ""}'</span>
                   <span className="inline-flex items-center gap-1"><EventIcon type={e.type} /> {e.player ? <Link to="/players/$id" params={{ id: e.player.id }} className="font-semibold hover:text-primary">{e.player.name}</Link> : <span>{e.description ?? e.type}</span>}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.team?.name}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-muted-foreground">No events yet.</div>}
        </div>

        <div className="space-y-4"><div className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 text-sm font-semibold">Match information</div><dl className="grid grid-cols-2 gap-3 text-sm">{[["Date & time", formatKickoff(match.kickoff_at)], ["Stadium", match.venue || "—"], ["City", match.city || "—"], ["Referee", match.referee || "—"]].map(([k,v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl></div>{match.highlight_url && <a href={match.highlight_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-semibold hover:border-primary"><PlayCircle className="h-5 w-5 text-primary" /> Watch match highlights</a>}{prediction.data && <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 text-sm font-semibold">Prediction</div><div className="grid grid-cols-3 text-center text-xs"><div><strong className="block text-lg">{prediction.data.home_percent}%</strong>{match.home?.name}</div><div><strong className="block text-lg">{prediction.data.draw_percent}%</strong>Draw</div><div><strong className="block text-lg">{prediction.data.away_percent}%</strong>{match.away?.name}</div></div></div>}{broadcasts.data && broadcasts.data.length > 0 && <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4" /> Where to watch</div><div className="flex flex-wrap gap-3">{broadcasts.data.map((row, index) => { const channel = Array.isArray(row.channel) ? row.channel[0] : row.channel; return channel ? <div key={channel.id ?? index} className="flex items-center gap-2 text-sm">{channel.logo_url && <img src={channel.logo_url} alt="" className="h-7 w-7 object-contain" />}{channel.name}</div> : null; })}</div></div>}</div>
      </div>}

      {tab === "lineups" && <div className="grid gap-4 md:grid-cols-2">{[match.home, match.away].map((team) => <div key={team?.id ?? "tbd"} className="rounded-2xl border border-border bg-card p-4"><h3 className="mb-3 font-bold">{team?.name ?? "TBD"}</h3>{lineups.data?.filter((item) => item.team_id === team?.id).map((lu) => { const rating = ratings.data?.find((item) => item.player_id === lu.player_id)?.rating; return <Link key={lu.id} to="/players/$id" params={{ id: lu.player_id }} className="flex items-center gap-3 border-t border-border py-2 first:border-0"><div className="h-9 w-9 overflow-hidden rounded-full bg-muted">{lu.player?.photo_url && <img src={lu.player.photo_url} alt="" className="h-full w-full object-cover" />}</div><span className="w-6 text-xs text-muted-foreground">{lu.shirt_number ?? lu.player?.shirt_number}</span><span className="font-semibold">{lu.player?.name}</span>{rating != null && <span className={`ml-auto rounded px-2 py-1 text-xs font-black ${Number(rating) >= 8 ? "bg-success text-success-foreground" : Number(rating) >= 6.5 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{rating}</span>}<span className={rating == null ? "ml-auto text-xs text-muted-foreground" : "text-xs text-muted-foreground"}>{lu.is_starting ? lu.position_code ?? "XI" : "Bench"}</span></Link>; })}{!lineups.data?.some((item) => item.team_id === team?.id) && <p className="text-sm text-muted-foreground">No lineup posted.</p>}</div>)}</div>}
      {tab === "stats" && <div className="rounded-2xl border border-border bg-card p-4">{stats.data && stats.data.length > 0 ? stats.data.map((item) => <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr] border-t border-border py-3 text-center first:border-0"><strong>{item.home_value}</strong><span className="text-muted-foreground">{item.label}</span><strong>{item.away_value}</strong></div>) : <p className="text-sm text-muted-foreground">No statistics published yet.</p>}</div>}
      {tab === "previous" && <PreviousMatches competitionId={match.competition_id} currentId={match.id} />}
      {tab === "media" && <div className="grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 font-bold">Videos & media</h3><div className="grid gap-2">{media.data?.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{item.title || "Open media"}</div></a>)}{media.data?.length === 0 && <p className="text-sm text-muted-foreground">No media posted.</p>}</div></div><div><h3 className="mb-3 flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4" /> Match chat</h3><div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-3">{chat.data?.map((message) => <div key={message.id} className="rounded-lg bg-muted p-2 text-sm">{message.body}</div>)}{chat.data?.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}</div>{user ? <form className="mt-2 flex gap-2" onSubmit={async (event) => { event.preventDefault(); const body = chatBody.trim(); if (!body) return; const blocked = /\b(fuck|shit|bitch|cunt)\b/i.test(body); if (blocked) return alert("Please keep the chat respectful."); await supabase.from("match_chat_messages").insert({ match_id: id, user_id: user.id, body } as never); setChatBody(""); chat.refetch(); }}><input className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" value={chatBody} onChange={(e) => setChatBody(e.target.value)} maxLength={500} placeholder="Write a message…" /><button className="rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Send</button></form> : <Link to="/auth" className="mt-2 block rounded-lg border border-border p-3 text-center text-sm font-semibold">Sign in to join the chat</Link>}</div></div>}
    </AppShell>
  );
}

function PreviousMatches({ competitionId, currentId }: { competitionId: string; currentId: string }) {
  const q = useQuery({ queryKey: ["previous-matches", competitionId, currentId], queryFn: async () => (await supabase.from("matches").select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)").eq("competition_id", competitionId).neq("id", currentId).in("status", ["ft", "aet", "pen", "awarded"]).order("kickoff_at", { ascending: false }).limit(10)).data ?? [] });
  return <div className="grid gap-2">{q.data?.map((match) => <Link key={match.id} to="/matches/$id" params={{ id: match.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"><span className="min-w-0 flex-1 truncate font-semibold">{match.home?.name ?? "TBD"} vs {match.away?.name ?? "TBD"}</span><strong>{match.home_score ?? 0}–{match.away_score ?? 0}</strong></Link>)}{q.data?.length === 0 && <p className="text-sm text-muted-foreground">No previous matches yet.</p>}</div>;
}

function EventIcon({ type }: { type: string }) {
  const map: Record<string, string> = { goal: "⚽", own_goal: "⚽", penalty: "⚽", missed_penalty: "❌", yellow: "🟨", red: "🟥", second_yellow: "🟨🟥", sub: "🔁" };
  return <span>{map[type] ?? "•"}</span>;
}