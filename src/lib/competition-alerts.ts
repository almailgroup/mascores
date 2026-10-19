import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * One shared copy of the competition bell overrides for the signed-in account.
 * Every competition bell and every match bell reads the same list, so pressing a
 * league bell lights up all of its match bells instantly with no extra loading.
 */
let state: { userId: string | null; overrides: Record<string, boolean> } = { userId: null, overrides: {} };
let loading: Promise<void> | null = null;
let loadingFor: string | null | undefined;
let revision = 0;
let saveQueue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

function load(userId: string | null): Promise<void> {
  if (!userId) { state = { userId: null, overrides: {} }; emit(); return Promise.resolve(); }
  if (state.userId === userId && loadingFor === userId && !loading) return Promise.resolve();
  if (loading && loadingFor === userId) return loading;
  loadingFor = userId;
  const at = revision;
  loading = (async () => {
    const { data } = await supabase.from("profiles").select("notification_preferences").eq("id", userId).maybeSingle();
    const prefs = data?.notification_preferences as { competition_alert_overrides?: Record<string, boolean> } | null | undefined;
    // A bell pressed while loading wins over the older stored copy.
    if (at === revision) state = { userId, overrides: { ...(prefs?.competition_alert_overrides ?? {}) } };
    else state = { ...state, userId };
    emit();
  })().finally(() => { loading = null; });
  return loading;
}

export function useCompetitionAlerts() {
  const { user, loading: authLoading } = useAuth();
  const [, force] = useState(0);
  const userId = user?.id ?? null;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  useEffect(() => { if (!authLoading) void load(userId); }, [userId, authLoading]);
  const overrides = state.userId === userId ? state.overrides : {};
  const setCompetitionAlert = async (competitionId: string, enabled: boolean) => {
    const previous = state.overrides[competitionId];
    const at = ++revision;
    state = { ...state, overrides: { ...state.overrides, [competitionId]: enabled } };
    emit();
    const save = saveQueue.catch(() => {}).then(async () => {
      const { error } = await supabase.rpc("set_competition_notification", { _competition_id: competitionId, _enabled: enabled });
      if (error) throw error;
    });
    saveQueue = save;
    try { await save; } catch (error) {
      if (at === revision) {
        const next = { ...state.overrides };
        if (previous === undefined) delete next[competitionId]; else next[competitionId] = previous;
        state = { ...state, overrides: next };
        emit();
      }
      throw error;
    }
  };
  return { overrides, setCompetitionAlert };
}

/** Competition of each match, remembered so match bells don't refetch it. */
const matchCompetition = new Map<string, Promise<string | null>>();
export function competitionOfMatch(matchId: string): Promise<string | null> {
  let p = matchCompetition.get(matchId);
  if (!p) {
    p = Promise.resolve(supabase.from("matches").select("competition_id").eq("id", matchId).maybeSingle()).then(({ data }) => data?.competition_id ?? null);
    matchCompetition.set(matchId, p);
  }
  return p;
}
