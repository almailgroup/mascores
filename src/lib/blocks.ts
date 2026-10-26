import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type BlockedUser = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; blocked_at: string };

/** Accounts the signed-in user has blocked. Their profile, recordings' comments
 *  and follow actions are hidden; the database also refuses follows/comments between them. */
export function useBlockedUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["blocked-users", user?.id ?? null];
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_blocked_users");
      if (error) throw error;
      return (data ?? []) as BlockedUser[];
    },
  });
  const ids = new Set((q.data ?? []).map((b) => b.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["blocked-users"] });
  return {
    list: q.data ?? [],
    isLoading: q.isLoading,
    isBlocked: (id: string | null | undefined) => !!id && ids.has(id),
    block: async (id: string) => { const { error } = await supabase.rpc("block_user", { _target: id }); if (error) throw error; await refresh(); },
    unblock: async (id: string) => { const { error } = await supabase.rpc("unblock_user", { _target: id }); if (error) throw error; await refresh(); },
  };
}
