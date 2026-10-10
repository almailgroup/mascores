import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useTx } from "@/lib/auto-translate";
import { ensureNativePermission, isNativeApp } from "@/lib/native-notify";

const KEY = "mas.player_alert_overrides";
function read(): Record<string, boolean> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}

export function PlayerNotificationButton({ playerId }: { playerId: string }) {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const tx = useTx();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => { setOverrides(read()); }, [playerId]);
  const active = overrides[playerId] ?? favorites.player.includes(playerId);
  const label = tx(active ? "Turn off player notifications" : "Turn on player notifications");
  const write = (v: Record<string, boolean>) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* optional */ } setOverrides(v); };
  return <Button data-no-gesture variant="ghost" size="icon" title={label ?? undefined} aria-label={label ?? undefined} aria-pressed={active} className="sports-header-control bg-transparent text-current hover:bg-transparent" onClick={async (event) => {
    event.preventDefault(); event.stopPropagation();
    const previous = read();
    write({ ...previous, [playerId]: !active });
    try {
      if (!active && isNativeApp()) void ensureNativePermission().catch(() => {});
      if (user) { const { error } = await supabase.rpc("set_player_notification", { _player_id: playerId, _enabled: !active }); if (error) throw error; }
    } catch { write(previous); toast.error(tx("Unable to save notifications")); }
  }}><Bell className="h-4 w-4" fill={active ? "currentColor" : "none"} /></Button>;
}
