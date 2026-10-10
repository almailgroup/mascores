import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClubAlerts } from "@/hooks/use-club-alerts";
import { useFavorites } from "@/hooks/use-favorites";
import { useTx } from "@/lib/auto-translate";
import { ensureNativePermission, isNativeApp } from "@/lib/native-notify";

export function ClubNotificationButton({ teamId }: { teamId: string }) {
  const { overrides, saving, setClubAlert } = useClubAlerts();
  const { favorites } = useFavorites();
  const tx = useTx();
  const active = overrides[teamId] ?? favorites.team.includes(teamId);
  const label = tx(active ? "Turn off club notifications" : "Turn on club notifications");
  return <Button variant="ghost" size="icon" title={label ?? undefined} aria-label={label ?? undefined} aria-pressed={active} disabled={saving} className="sports-header-control bg-transparent text-current hover:bg-transparent" onClick={async () => {
    try {
      if (!active && isNativeApp()) await ensureNativePermission();
      await setClubAlert(teamId, !active);
    } catch { toast.error(tx("Unable to save notifications")); }
  }}><Bell className="h-4 w-4" fill={active ? "currentColor" : "none"} /></Button>;
}