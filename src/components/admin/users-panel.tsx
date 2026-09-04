import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldOff, ShieldCheck, Search } from "lucide-react";
import { listModeratedUsers, setUserSuspension, clearUserSuspension, type ModeratedUser } from "@/lib/moderation.functions";
import { Field, inputCls, btnPrimary, btnGhost, btnDanger, Modal } from "./ui";

/** Admin moderation: ban an account for good or suspend it for a set number of days. */
export function UsersPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<ModeratedUser | null>(null);
  const load = useServerFn(listModeratedUsers);
  const suspend = useServerFn(setUserSuspension);
  const clear = useServerFn(clearUserSuspension);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => load({ data: {} }),
  });

  const term = search.trim().toLowerCase();
  const rows = (users.data ?? []).filter((user) => !term || (user.email ?? "").toLowerCase().includes(term) || (user.displayName ?? "").toLowerCase().includes(term));
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const state = (user: ModeratedUser) => {
    if (user.banned) return "Banned";
    if (user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()) return `Suspended until ${new Date(user.suspendedUntil).toLocaleDateString()}`;
    return "Active";
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Users & moderation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ban or suspend an account. Suspended users cannot post in match chat, host or speak in voice rooms, or buy tickets.</p>
      </div>
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input className={`${inputCls} ps-8`} placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {users.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {users.isError && <p className="text-sm text-destructive">Could not load accounts.</p>}

      <div className="space-y-2">
        {rows.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {user.avatarUrl && <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user.displayName ?? user.email ?? "Account"}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{user.email}</div>
              <div className={`mt-0.5 text-[0.65rem] font-semibold ${user.banned || user.suspendedUntil ? "text-destructive" : "text-muted-foreground"}`}>
                {state(user)}{user.reason ? ` · ${user.reason}` : ""}
              </div>
            </div>
            {(user.banned || user.suspendedUntil) ? (
              <button className={btnGhost} onClick={async () => { await clear({ data: { userId: user.id } }); refresh(); }}>
                <ShieldCheck className="h-3.5 w-3.5" /> Lift
              </button>
            ) : null}
            <button className={btnDanger} onClick={() => setTarget(user)}><ShieldOff className="h-3.5 w-3.5" /> Restrict</button>
          </div>
        ))}
        {!users.isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">No accounts match that search.</p>}
      </div>

      {target && <RestrictModal user={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); refresh(); }} save={suspend} />}
    </div>
  );
}

function RestrictModal({ user, onClose, onDone, save }: {
  user: ModeratedUser;
  onClose: () => void;
  onDone: () => void;
  save: (args: { data: { userId: string; banned: boolean; days: number; reason?: string } }) => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"suspend" | "ban">("suspend");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await save({ data: { userId: user.id, banned: mode === "ban", days: mode === "ban" ? 0 : Math.max(1, Number(days) || 1), reason } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this restriction.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Restrict ${user.displayName ?? user.email ?? "account"}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["suspend", "ban"] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)}
              className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-bold capitalize ${mode === k ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>
              {k === "suspend" ? "Suspend for a period" : "Ban permanently"}
            </button>
          ))}
        </div>
        {mode === "suspend" && (
          <Field label="Days"><input className={inputCls} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        )}
        <Field label="Reason (shown to the user)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Abusive messages in match chat" /></Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy} onClick={submit}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save restriction</button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
