import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { useBlockedUsers } from "@/lib/blocks";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

/** Settings list of blocked accounts with an Unblock button for each. */
export function BlockedAccounts() {
  const { list, isLoading, unblock } = useBlockedUsers();
  const { lang } = useI18n(); const label = (en: string, ar: string) => lang === "ar" ? ar : en;
  const [busy, setBusy] = useState<string | null>(null);
  return <div className="border-t border-border pt-4">
    <h3 className="text-sm font-semibold">{label("Blocked accounts", "الحسابات المحظورة")}</h3>
    {isLoading ? null : list.length === 0
      ? <p className="mt-2 text-xs text-muted-foreground">{label("You haven't blocked anyone.", "لم تحظر أي حساب.")}</p>
      : <ul className="mt-2 divide-y divide-border">{list.map((p) => <li key={p.id} className="flex items-center gap-3 py-2">
          <Link to="/u/$username" params={{ username: p.username ?? p.id }} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4 text-muted-foreground" />}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.display_name ?? p.username}</span>{p.username && <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>}</span>
          </Link>
          <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={async () => {
            if (!confirm(label(`Unblock ${p.display_name ?? p.username ?? "this account"}?`, "إلغاء حظر هذا الحساب؟"))) return;
            setBusy(p.id);
            try { await unblock(p.id); toast.success(label("Account unblocked", "تم إلغاء الحظر")); } catch { toast.error(label("Could not unblock. Please try again.", "تعذر إلغاء الحظر.")); }
            setBusy(null);
          }}>{label("Unblock", "إلغاء الحظر")}</Button>
        </li>)}</ul>}
  </div>;
}
