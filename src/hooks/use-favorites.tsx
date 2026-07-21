import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type FavoriteKind = "team" | "player" | "competition" | "match";

const COLS = {
  team: "favorite_team_ids",
  player: "favorite_player_ids",
  competition: "favorite_competition_ids",
} as const;

const MATCH_KEY = "mas.favorite_match_ids";

type FavoritesState = { team: string[]; player: string[]; competition: string[]; match: string[] };

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoritesState>({ team: [], player: [], competition: [], match: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const match = safeReadLocal(MATCH_KEY);
      if (!user) {
        if (!cancel) {
          setFavorites({ team: [], player: [], competition: [], match });
          setReady(true);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("favorite_team_ids, favorite_player_ids, favorite_competition_ids")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancel) {
        setFavorites({
          team: data?.favorite_team_ids ?? [],
          player: data?.favorite_player_ids ?? [],
          competition: data?.favorite_competition_ids ?? [],
          match,
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
      setFavorites((prev) => ({ ...prev, [kind]: next }));
      if (kind === "match") {
        try {
          localStorage.setItem(MATCH_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return;
      }
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ [COLS[kind]]: next })
        .eq("id", user.id);
    },
    [favorites, user],
  );

  return { favorites, isFavorite, toggle, ready };
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

export function FavoriteButton({ kind, id, size = "sm" }: { kind: FavoriteKind; id: string | number; size?: "sm" | "md" }) {
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