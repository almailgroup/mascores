import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, KeyRound, Trash2, UserPlus, LogOut, Copy, Mail, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addManagedUser, listManagedUsers, removeManagedGrant, resetManagedPassword, resendAccessEmail, setGrantApproval,
  setManagedScopes, signOutEveryoneElse, GRANT_SCOPES, type GrantScope, type ManagedUser,
} from "@/lib/owner.functions";

import { Field, inputCls, btnPrimary, btnGhost, btnDanger, Modal } from "./ui";

const SCOPE_LABEL: Record<GrantScope, string> = {
  all: "Everything",
  news: "News (all clubs)",
  club_news: "News for one club",
  rabta: "Rabta / Ultras posts",
  tickets: "Tickets",
  matches: "Matches & live",
  voice: "Voice rooms",
  teams: "Clubs & squads",
  players: "Players",
  standings: "Standings",
  transfers: "Transfers",
  venues: "Stadiums",
  competitions: "Competitions",
  channels: "TV channels",
  ai: "Almail AI tools",
  chat: "Chat moderation",
  scanner: "Ticket scanning only (/scanner)",

};

/** Owner-only area: hand out limited access and decide who needs approval. */
export function ManagePanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string; emailed: boolean } | null>(null);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useServerFn(listManagedUsers);
  const removeGrant = useServerFn(removeManagedGrant);
  const approval = useServerFn(setGrantApproval);
  const resetPassword = useServerFn(resetManagedPassword);
  const resendEmail = useServerFn(resendAccessEmail);
  const signOutOthers = useServerFn(signOutEveryoneElse);


  const users = useQuery({ queryKey: ["owner-managed"], queryFn: () => load() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["owner-managed"] });
  const withAccess = (users.data ?? []).filter((u) => u.grants.length > 0);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Manage people</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add someone, choose exactly what they can touch, and decide whether their posts wait for your approval.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => setOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Add person</button>
        <button
          className={btnGhost}
          onClick={async () => {
            if (!confirm("Sign every other account out of every device?")) return;
            const res = await signOutOthers();
            alert(`Signed out ${res.count} accounts.`);
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out everyone else
        </button>
      </div>

      {users.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {users.isError && <p className="text-sm text-destructive">Only the owner account can open this section.</p>}

      <div className="space-y-2">
        {withAccess.map((user) => (
          <div key={user.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-[55%]">
                <div className="truncate text-sm font-bold">{user.displayName ?? user.email}</div>
                <div className="truncate text-[0.7rem] text-muted-foreground">{user.email}</div>
              </div>
              <button className={btnGhost} onClick={() => setEditUser(user)}>
                <Pencil className="h-3.5 w-3.5" /> Edit access
              </button>
              <button
                className={btnGhost}
                onClick={async () => {
                  const res = await resetPassword({ data: { userId: user.id } });
                  setSecret({ email: user.email ?? "", password: res.password, emailed: res.emailed });
                }}
              >
                <KeyRound className="h-3.5 w-3.5" /> Show password
              </button>
              <button
                className={btnGhost}
                onClick={async () => {
                  const res = await resendEmail({ data: { userId: user.id } });
                  setNote(res.emailed ? `Sign-in email sent again to ${user.email}.` : `Could not email ${user.email} right now.`);
                }}
              >
                <Mail className="h-3.5 w-3.5" /> Send email again
              </button>

            </div>
            <div className="mt-2 space-y-1.5">
              {user.grants.map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <span className="min-w-0 flex-1 basis-[50%] truncate text-xs font-semibold">
                    {SCOPE_LABEL[g.scope]}{g.teamName ? ` — ${g.teamName}` : ""}
                  </span>
                  <button
                    className={`inline-flex h-7 items-center rounded-full px-3 text-[0.65rem] font-bold ${g.requiresApproval ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}
                    onClick={async () => { await approval({ data: { grantId: g.id, requiresApproval: !g.requiresApproval } }); refresh(); }}
                  >
                    {g.requiresApproval ? "Needs my approval" : "Free access"}
                  </button>
                  <button className={btnDanger} onClick={async () => { await removeGrant({ data: { grantId: g.id } }); refresh(); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!users.isLoading && withAccess.length === 0 && <p className="text-sm text-muted-foreground">Nobody has extra access yet.</p>}
      </div>

      {open && <AddPersonModal onClose={() => setOpen(false)} onDone={(s) => { setOpen(false); setSecret(s); refresh(); }} />}
      {editUser && <EditAccessModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); refresh(); }} />}
      {note && (
        <Modal open onClose={() => setNote(null)} title="Email">
          <p className="text-sm">{note}</p>
        </Modal>
      )}
      {secret && (
        <Modal open onClose={() => setSecret(null)} title="Share these details">
          <p className="text-sm text-muted-foreground">This is their password. It stays the same, so you can look it up here any time.</p>
          <div className="mt-3 space-y-2 rounded-2xl border border-border bg-muted/50 p-3 text-sm">
            <div><span className="text-muted-foreground">Email:</span> <b>{secret.email}</b></div>
            <div><span className="text-muted-foreground">Password:</span> <b>{secret.password}</b></div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {secret.emailed ? "A sign-in email was sent to them as well." : "We could not email them — pass these details on yourself."}
          </p>
          <button className={`${btnGhost} mt-3`} onClick={() => navigator.clipboard?.writeText(`${secret.email} / ${secret.password}`)}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </Modal>
      )}

    </div>
  );
}

/** Lets the owner tie a helper to certain competitions. Nothing ticked = every competition. */
function CompetitionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const comps = useQuery({
    queryKey: ["owner-competitions"],
    queryFn: async () => (await supabase.from("competitions").select("id,name,country").order("name")).data ?? [],
  });
  const needle = search.trim().toLowerCase();
  const list = (comps.data ?? []).filter((c) => !needle || `${c.name} ${c.country ?? ""}`.toLowerCase().includes(needle)).slice(0, 120);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Field label="Which competitions can they manage? (leave empty for all)">
      <input className={inputCls} placeholder="Search competitions…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
        {list.map((c) => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" onClick={() => toggle(c.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start text-xs font-semibold ${on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
              <span className="min-w-0 truncate">{c.name}{c.country ? ` · ${c.country}` : ""}</span>
              {on && <span>✓</span>}
            </button>
          );
        })}
        {list.length === 0 && <p className="p-3 text-xs text-muted-foreground">No matching competition.</p>}
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        {value.length === 0 ? "They can manage every competition and club." : `Only ${value.length} competition${value.length === 1 ? "" : "s"} and the clubs inside them.`}
      </p>
    </Field>
  );
}

function AddPersonModal({ onClose, onDone }: { onClose: () => void; onDone: (secret: { email: string; password: string; emailed: boolean } | null) => void }) {
  const [email, setEmail] = useState("");
  const [scopes, setScopes] = useState<GrantScope[]>(["news"]);
  const [teamId, setTeamId] = useState("");
  const [competitionIds, setCompetitionIds] = useState<string[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useServerFn(addManagedUser);

  const teams = useQuery({
    queryKey: ["owner-teams"],
    queryFn: async () => (await supabase.from("teams").select("id,name").order("name")).data ?? [],
  });

  const needsTeam = scopes.includes("club_news") || scopes.includes("rabta");
  const toggle = (scope: GrantScope) =>
    setScopes((list) => (list.includes(scope) ? list.filter((item) => item !== scope) : [...list, scope]));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await add({ data: { email, scopes, teamId: needsTeam ? (teamId || null) : null, competitionIds, requiresApproval } });
      onDone(res.password ? { email: email.trim().toLowerCase(), password: res.password, emailed: res.emailed } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Add person">
      <div className="space-y-3">
        <Field label="Their email"><input className={inputCls} inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
        <Field label="What can they reach? (pick as many as you like)">
          <div className="grid grid-cols-2 gap-1.5">
            {GRANT_SCOPES.map((s) => {
              const on = scopes.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggle(s)}
                  className={`rounded-xl border px-3 py-2 text-start text-xs font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                  {SCOPE_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>
        {needsTeam && (
          <Field label="Which club?">
            <select className={inputCls} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Pick a club…</option>
              {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
          Their posts wait for my approval
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy || !email || scopes.length === 0 || (needsTeam && !teamId)} onClick={submit}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save access
          </button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/** Changes what an existing person can reach — ticks are added or removed, nobody is deleted. */
function EditAccessModal({ user, onClose, onSaved }: { user: ManagedUser; onClose: () => void; onSaved: () => void }) {
  const [scopes, setScopes] = useState<GrantScope[]>(user.grants.map((g) => g.scope));
  const [teamId, setTeamId] = useState(user.grants.find((g) => g.teamId)?.teamId ?? "");
  const [requiresApproval, setRequiresApproval] = useState(user.grants.some((g) => g.requiresApproval));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useServerFn(setManagedScopes);

  const teams = useQuery({
    queryKey: ["owner-teams"],
    queryFn: async () => (await supabase.from("teams").select("id,name").order("name")).data ?? [],
  });

  const needsTeam = scopes.includes("club_news") || scopes.includes("rabta");
  const toggle = (scope: GrantScope) =>
    setScopes((list) => (list.includes(scope) ? list.filter((item) => item !== scope) : [...list, scope]));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await save({ data: { userId: user.id, scopes, teamId: needsTeam ? (teamId || null) : null, requiresApproval } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Access for ${user.displayName ?? user.email ?? "this person"}`}>
      <div className="space-y-3">
        <Field label="What can they reach? (pick as many as you like)">
          <div className="grid grid-cols-2 gap-1.5">
            {GRANT_SCOPES.map((s) => {
              const on = scopes.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggle(s)}
                  className={`rounded-xl border px-3 py-2 text-start text-xs font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                  {SCOPE_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>
        {needsTeam && (
          <Field label="Which club?">
            <select className={inputCls} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Pick a club…</option>
              {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
          Their new posts and tickets wait for my approval
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy || scopes.length === 0 || (needsTeam && !teamId)} onClick={submit}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save access
          </button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
