import {useState} from "react";
import {useServerFn} from "@tanstack/react-start";
import {readSocialLinks} from "@/lib/social-links.functions";
import type {SocialLinkDraft} from "@/lib/social-link-batch";
import {supabase} from "@/integrations/supabase/client";
import type {Player} from "@/lib/db";
import {normalizeSocial} from "@/components/social-links";
import {Button} from "@/components/ui/button";
import {Modal,inputCls} from "./ui";

export function SocialLinkBatch({teamId,players,onClose,onSaved}:{teamId:string;players:Player[];onClose:()=>void;onSaved:()=>void}){
 const read=useServerFn(readSocialLinks);const [notes,setNotes]=useState("");const [drafts,setDrafts]=useState<SocialLinkDraft[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <Modal open onClose={onClose} title="Social links with AI"><textarea aria-label="Player names and social links" rows={6} className={inputCls} placeholder="Player name or shirt number, followed by their social links…" value={notes} onChange={e=>setNotes(e.target.value)}/><Button className="mt-3" disabled={busy||!notes.trim()} onClick={async()=>{setBusy(true);setError("");try{const rows=await read({data:{teamId,notes}});setDrafts(rows);if(!rows.length)setError("No matching supplied links found.");}catch(e){setError(e instanceof Error?e.message:"Could not read links.");}finally{setBusy(false);}}}>{busy?"Reading…":"Read links"}</Button><div className="mt-3 divide-y divide-border">{drafts.map((d,i)=><div key={i} className="py-2 text-sm"><strong>{players.find(p=>p.id===d.player_id)?.name}</strong><div className="break-all text-xs text-muted-foreground">{d.network}: {d.url}</div></div>)}</div>{drafts.length>0 && <Button className="mt-3" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{for(const id of new Set(drafts.map(d=>d.player_id))){const {data:player,error:readError}=await supabase.from("players").select("social_links").eq("id",id).single();if(readError)throw readError;const links=normalizeSocial(player.social_links);for(const d of drafts.filter(d=>d.player_id===id))links[d.network]=d.url;const {error}=await supabase.from("players").update({social_links:links}).eq("id",id);if(error)throw error;}onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:"Save failed.");}finally{setBusy(false);}}}>Save changes</Button>}{error&&<p className="mt-2 text-sm text-destructive">{error}</p>}</Modal>;
}