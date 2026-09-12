import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { Bell, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

export type FavoriteKind = "team" | "player" | "competition" | "match";

const MATCH_KEY = "mas.favorite_match_ids";
const ALERT_KEY = "mas.match_notification_ids";
const PREF_KEY = "mas.notification_preferences";

type FavoritesState = { team: string[]; player: string[]; competition: string[]; match: string[] };

/** One shared list of favourites, so a star pressed in one place updates every
 *  other star and bell on the page straight away. */
let shared: FavoritesState | null = null;
const listeners = new Set<(next: FavoritesState) => void>();
function publish(next: FavoritesState) {
  shared = next;
  for (const listener of listeners) listener(next);
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoritesState>(shared ?? { team: [], player: [], competition: [], match: [] });
  const [ready, setReady] = useState(shared !== null);

  useEffect(() => {
    listeners.add(setFavorites);
    return () => { listeners.delete(setFavorites); };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const match = safeReadLocal(MATCH_KEY);
      if (!user) {
        if (!cancel) {
          publish({ team: [], player: [], competition: [], match });
          setReady(true);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("favorite_team_ids, favorite_player_ids, favorite_competition_ids, favorite_match_ids")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancel) {
        publish({
          team: data?.favorite_team_ids ?? [],
          player: data?.favorite_player_ids ?? [],
          competition: data?.favorite_competition_ids ?? [],
          match: data?.favorite_match_ids ?? match,
        });
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const isFavorite = useCallback(
    (kind: FavoriteKind, id: string | number) => favorites[kind].includes(String(id)),
    [favorites],
  );

  const toggle = useCallback(
    async (kind: FavoriteKind, id: string | number) => {
      const strId = String(id);
      const has = favorites[kind].includes(strId);
      const next = has ? favorites[kind].filter((x) => x !== strId) : [...favorites[kind], strId];
      publish({ ...favorites, [kind]: next });
      if (kind === "match") {
        try {
          localStorage.setItem(MATCH_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        if (user) await supabase.from("profiles").update({ favorite_match_ids: next }).eq("id", user.id);
        return;
      }
      if (!user) return;
      const patch =
        kind === "team" ? { favorite_team_ids: next }
        : kind === "player" ? { favorite_player_ids: next }
        : { favorite_competition_ids: next };
      await supabase.from("profiles").update(patch).eq("id", user.id);
    },
    [favorites, user],
  );

  /** Adds a favourite without removing it if it is already saved. */
  const add = useCallback(
    async (kind: FavoriteKind, id: string | number) => {
      if (favorites[kind].includes(String(id))) return;
      await toggle(kind, id);
    },
    [favorites, toggle],
  );

  return { favorites, isFavorite, toggle, add, ready };
}

function safeReadLocal(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function FavoriteButton({ kind, id, size = "sm", onFollow }: { kind: FavoriteKind; id: string | number; size?: "sm" | "md"; onFollow?: () => void }) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(kind, id);
  const disabled = kind !== "match" && !user;
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <button
      type="button"
      title={disabled ? "Sign in to save favorites" : active ? "Remove favorite" : "Add to favorites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        toggle(kind, id);
        if (!active) onFollow?.();
      }}
      className={`inline-flex ${dim} items-center justify-center rounded-full border transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2" />
      </svg>
    </button>
  );
}

type AlertPrefs = { goals?: boolean; cards?: boolean; kickoff?: boolean; final?: boolean };

const PREF_ROWS: { key: keyof AlertPrefs; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "cards", label: "Yellow and red cards" },
  { key: "kickoff", label: "Kick-off" },
  { key: "final", label: "Full time" },
];

/**
 * Match bell. Pressing it switches the match alerts on or off; the small
 * sliders button next to it chooses which moments are announced.
 */
export function MatchNotificationButton({ matchId, teamIds = [], withSettings = false }: { matchId: string; teamIds?: (string | null | undefined)[]; withSettings?: boolean }) {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<AlertPrefs>({});
  const [openPrefs, setOpenPrefs] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const inherited = teamIds.some((id) => Boolean(id && favorites.team.includes(id)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = safeReadLocal(ALERT_KEY);
      let localPrefs: AlertPrefs = {};
      try { localPrefs = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as AlertPrefs; } catch { /* none yet */ }
      if (!user) {
        if (!cancelled) { setAlerts(local); setPrefs(localPrefs); setLoaded(true); }
        return;
      }
      const { data } = await supabase.from("profiles").select("match_notification_ids,notification_preferences").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        setAlerts(data?.match_notification_ids ?? local);
        const saved = data?.notification_preferences;
        setPrefs(saved && typeof saved === "object" && !Array.isArray(saved) ? { ...localPrefs, ...(saved as AlertPrefs) } : localPrefs);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!openPrefs) return;
    const close = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpenPrefs(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openPrefs]);

  const explicit = alerts.includes(matchId);
  // For a followed club the saved match id is a deliberate mute override;
  // otherwise it is an explicit opt-in for this individual fixture.
  const active = inherited ? !explicit : explicit;

  const savePrefs = async (next: AlertPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* optional */ }
    if (user) await supabase.from("profiles").update({ notification_preferences: next as never }).eq("id", user.id);
    window.dispatchEvent(new Event("mas:alerts-changed"));
  };

  return (
    <div ref={box} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={active ? "Disable match notifications" : "Enable match notifications"}
        title={inherited && active ? "Following this club's matches" : active ? "Disable match notifications" : "Enable match notifications"}
        disabled={!loaded}
        onClick={async (event) => {
          event.preventDefault(); event.stopPropagation();
          const next = explicit ? alerts.filter((id) => id !== matchId) : [...alerts, matchId];
          const turningOn = inherited ? explicit : !explicit;
          setAlerts(next);
          try { localStorage.setItem(ALERT_KEY, JSON.stringify(next)); } catch { /* optional */ }
          if (user) await supabase.from("profiles").update({ match_notification_ids: next }).eq("id", user.id);
          // Tell the live alert listener to pick the new selection up straight away.
          window.dispatchEvent(new Event("mas:alerts-changed"));
          if (turningOn) {
            if ("Notification" in window && Notification.permission === "default") {
              try { await Notification.requestPermission(); } catch { /* declined */ }
            }
            toast.success("Match alerts on", { description: "Goals, cards and full time will be announced." });
          } else {
            toast("Match alerts off");
          }
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-primary"}`}
      >
        <Bell className="h-4 w-4" fill={active ? "currentColor" : "none"} />
      </button>
      {withSettings && (
        <button
          type="button"
          aria-label="Choose what is announced"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenPrefs((v) => !v); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-primary"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      )}
      {withSettings && openPrefs && (
        <div className="absolute end-0 top-10 z-[80] w-60 rounded-2xl border border-border bg-card p-3 text-start text-foreground shadow-2xl">
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Announce for this match</p>
          <div className="space-y-1.5">
            {PREF_ROWS.map((row) => {
              const on = prefs[row.key] !== false;
              return (
                <label key={row.key} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs font-semibold">
                  <span>{row.label}</span>
                  <input type="checkbox" className="h-4 w-4" checked={on} onChange={(e) => savePrefs({ ...prefs, [row.key]: e.target.checked })} />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
