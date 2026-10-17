import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useClubAlerts } from "@/hooks/use-club-alerts";
import { useFavorites } from "@/hooks/use-favorites";
import { useTx } from "@/lib/auto-translate";
import { requestAlertPermission } from "@/lib/notification-permission";
import { useSignInAction } from "@/lib/sign-in-action";
import { useAuth } from "@/hooks/use-auth";

export function ClubNotificationButton({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const signIn = useSignInAction();
  const { overrides, setClubAlert } = useClubAlerts();
  const { favorites } = useFavorites();
  const tx = useTx();
  const active = overrides[teamId] ?? favorites.team.includes(teamId);
  const label = tx(active ? "Turn off club notifications" : "Turn on club notifications");
  return <Button data-no-gesture variant="ghost" size="icon" title={label ?? undefined} aria-label={label ?? undefined} aria-pressed={active} className="sports-header-control bg-transparent text-current hover:bg-transparent" onClick={async (event) => {
    event.preventDefault(); event.stopPropagation();
    if (!user) { signIn(); return; }
    try {
      if (!(await requestAlertPermission())) return;
      await setClubAlert(teamId, !active);
    } catch { toast.error(tx("Unable to save notifications")); }
  }}><Bell className="h-4 w-4" fill={active ? "currentColor" : "none"} /></Button>;
}