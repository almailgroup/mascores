import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Check, X } from "lucide-react";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { assignableVerificationBadge, canReplyToVerification } from '@/lib/verification';

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
  const [replies,setReplies]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);

  const requests = useQuery({
    queryKey: ["admin", "verification-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("id,user_id,proof,links,status,created_at,profiles(username,display_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if(error)throw error;
      return (data ?? []) as unknown as Request[];
    },
  });

  const decide = async (req: Request, badge: string|null) => {
    if(busy || !assignableVerificationBadge(badge))return;
    setBusy(req.id);
    const {error}=await supabase.rpc('review_verification',{_request:req.id,_badge:badge as string});
    setBusy(null);
    if(error){toast.error('Could not review the request');return;}
    toast.success(badge?'Verification approved':'Request declined');
    await qc.invalidateQueries({queryKey:['admin','verification-requests']});
    await qc.invalidateQueries({queryKey:['voice-people']});
    await qc.invalidateQueries({queryKey:['profile']});
  };

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /><h2 className="font-bold">Verification requests</h2></div>
      {requests.isError&&<Button variant="outline" onClick={()=>void requests.refetch()}>Retry requests</Button>}
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
              <Button disabled={busy!==null} variant="outline" size="sm" onClick={() => void decide(req, 'verified')}><Check/>Approve verified</Button>
              <Button disabled={busy!==null} variant="outline" size="sm" onClick={() => void decide(req, 'golden')}><BadgeCheck/>Approve golden</Button>
              <Button disabled={busy!==null} variant="destructive" size="sm" onClick={() => void decide(req, null)}><X/>Decline</Button>
            </div>
          )}
          {canReplyToVerification(req.status)&&<form className="mt-4 space-y-2" onSubmit={async e=>{
            e.preventDefault();const message=replies[req.id]?.trim();if(!message||busy)return;setBusy(req.id);
            const {error}=await supabase.rpc('reply_verification',{_request:req.id,_message:message});setBusy(null);
            if(error){toast.error('Could not send reply');return;}
            setReplies(old=>({...old,[req.id]:''}));toast.success('Reply sent to their notifications');
            await qc.invalidateQueries({queryKey:['social-activity']});
          }}><label className="block text-sm font-semibold">Reply to applicant<textarea aria-label={`Reply to ${req.profiles?.username??req.id}`} rows={3} maxLength={2000} value={replies[req.id]??''} onChange={e=>setReplies(old=>({...old,[req.id]:e.target.value}))} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base font-normal"/></label><Button type="submit" disabled={busy!==null||!replies[req.id]?.trim()} size="sm">Send reply</Button></form>}
        </div>
      ))}
      {(requests.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No verification requests yet.</p>}
    </div>
  );
}
