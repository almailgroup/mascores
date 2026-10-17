import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Check, X } from "lucide-react";
import { supabase } from "@/lib/db";
import { btnDanger, btnGhost } from "./ui";
import { toast } from "sonner";

type Request = {
  id: string;
  user_id: string;
  proof: string;
  links: string | null;
  status: string;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
};

/** Owner reviews verification requests and hands out the verified badge. */
export function VerifyPanel() {
  const qc = useQueryClient();

  const requests = useQuery({
    queryKey: ["admin", "verification-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("id,user_id,proof,links,status,created_at,profiles(username,display_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as Request[];
    },
  });

  const decide = async (req: Request, approve: boolean) => {
    const { error } = await supabase
      .from("verification_requests")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", req.id);
    if (error) { toast.error("Could not update the request"); return; }
    if (approve) {
      const { error: badgeError } = await supabase
        .from("voice_user_badges")
        .upsert({ user_id: req.user_id, badge: "verified" } as never);
      if (badgeError) { toast.error("Request approved but the badge could not be set"); return; }
    }
    toast.success(approve ? "Verified badge given" : "Request rejected");
    qc.invalidateQueries({ queryKey: ["admin", "verification-requests"] });
  };

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /><h2 className="font-bold">Verification requests</h2></div>
      {(requests.data ?? []).map((req) => (
        <div key={req.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 font-bold ${req.status === "pending" ? "bg-primary/15 text-primary" : req.status === "approved" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>{req.status}</span>
            <span>{new Date(req.created_at).toLocaleString()}</span>
            {req.profiles?.username && <Link to="/u/$username" params={{ username: req.profiles.username }} className="font-semibold text-primary">@{req.profiles.username}</Link>}
          </div>
          <div className="mt-1 font-semibold">{req.profiles?.display_name ?? "Unknown user"}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{req.proof}</p>
          {req.links && <p className="mt-1 whitespace-pre-wrap text-xs text-primary">{req.links}</p>}
          {req.status === "pending" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => decide(req, true)} className={btnGhost}><Check className="h-3 w-3" /> Approve & verify</button>
              <button onClick={() => decide(req, false)} className={btnDanger}><X className="h-3 w-3" /> Reject</button>
            </div>
          )}
        </div>
      ))}
      {(requests.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No verification requests yet.</p>}
    </div>
  );
}
