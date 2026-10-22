import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost } from "./ui";
import { uploadMedia } from "./upload";
import { PlayerAvatar } from "@/components/player-avatar";

type Status = "waiting" | "working" | "done" | "failed" | "skipped";

/** Sends one free-text request ("enhance and make them bald") to AI and applies it to every squad photo, one at a time. */
export function AiPhotoRequest({ open, onClose, players, onSaved }: { open: boolean; onClose: () => void; players: Player[]; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const withPhotos = players.filter((p) => p.photo_url);

  const run = async () => {
    if (!text.trim() || running) return;
    if (!confirm(`Edit ${withPhotos.length} player photos with this request? Each photo uses AI credits.`)) return;
    setRunning(true); setError(null); stop.current = false;
    setStatus(Object.fromEntries(withPhotos.map((p) => [p.id, "waiting" as Status])));
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    for (const p of withPhotos) {
      if (stop.current) { setStatus((c) => ({ ...c, [p.id]: "skipped" })); continue; }
      setStatus((c) => ({ ...c, [p.id]: "working" }));
      try {
        const res = await fetch("/api/ai-photo-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageUrl: p.photo_url, instruction: text }),
        });
        const json = await res.json().catch(() => null) as { b64?: string; error?: string } | null;
        if (!res.ok || !json?.b64) {
          setStatus((c) => ({ ...c, [p.id]: "failed" }));
          setError(json?.error ?? "Photo edit failed.");
          // Credit or permission problems stop the whole batch.
          if (res.status === 402 || res.status === 403 || res.status === 401) stop.current = true;
          if (res.status === 429) await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        const bytes = Uint8Array.from(atob(json.b64), (ch) => ch.charCodeAt(0));
        const url = await uploadMedia("player-photos", new File([bytes], `${p.id}.png`, { type: "image/png" }));
        if (url) await supabase.from("players").update({ photo_url: url }).eq("id", p.id);
        setStatus((c) => ({ ...c, [p.id]: "done" }));
        onSaved();
      } catch {
        setStatus((c) => ({ ...c, [p.id]: "failed" }));
      }
    }
    setRunning(false);
  };

  const label: Record<Status, string> = { waiting: "Waiting", working: "Editing…", done: "Done", failed: "Failed", skipped: "Stopped" };

  return (
    <Modal open={open} onClose={() => { if (!running) onClose(); }} title="AI photo request" wide>
      <p className="mb-3 text-xs text-muted-foreground">Tell the AI what to do and it will edit every player photo in this squad ({withPhotos.length} with photos). Players without a photo are skipped.</p>
      <Field label="Your request">
        <textarea className={`${inputCls} min-h-24`} placeholder='e.g. "Enhance the photos and make all of them bald"' value={text} disabled={running} onChange={(e) => setText(e.target.value)} />
      </Field>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {running
          ? <button className={btnGhost} onClick={() => { stop.current = true; }}>Stop after current</button>
          : <button className={btnGhost} onClick={onClose}>Close</button>}
        <button className={btnPrimary} disabled={running || !text.trim() || withPhotos.length === 0} onClick={run}>{running ? "Working…" : "Apply to all photos"}</button>
      </div>
      {Object.keys(status).length > 0 && (
        <div className="mt-4 grid gap-1">
          {withPhotos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
              <PlayerAvatar src={p.photo_url} name={p.name} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <span className={`text-[0.65rem] font-semibold ${status[p.id] === "done" ? "text-primary" : status[p.id] === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{status[p.id] ? label[status[p.id]] : ""}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
