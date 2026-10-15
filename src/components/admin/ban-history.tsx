import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function BanHistory({ userId }: { userId: string }) {
  const history = useQuery({
    queryKey: ['ban-history', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_ban_history').select('id,action,banned,suspended_until,reason,strike,created_at').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return <details className="mt-2 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-semibold">Ban history · {history.data?.filter((item) => item.action === 'restrict').length ?? 0} strikes</summary>
    <div className="mt-2 space-y-2">
      {history.isError && <p>Could not load ban history.</p>}
      {history.data?.length === 0 && <p>No previous bans.</p>}
      {history.data?.map((item) => <div key={item.id} className="border-s-2 border-border ps-2">
        <div>{item.action === 'lift' ? 'Restriction lifted' : `Strike ${item.strike} · ${item.banned ? 'Permanent ban' : `Banned until ${new Date(item.suspended_until ?? item.created_at).toLocaleDateString()}`}`}</div>
        <div>{new Date(item.created_at).toLocaleString()}{item.reason ? ` · ${item.reason}` : ''}</div>
      </div>)}
    </div>
  </details>;
}