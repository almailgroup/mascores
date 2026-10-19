import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, Mic, Pencil, X } from 'lucide-react';
import { RecordingPlayer } from '@/components/recording-player';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/lib/i18n';
import { uploadMedia } from '@/components/admin/upload';
import { Button } from '@/components/ui/button';
import { SocialScreen } from '@/components/social-screen';
import { RecordingSocial } from '@/components/recording-social';

export type Replay={id:string;host_id:string;title:string;cover_url:string|null;audio_url:string;duration_seconds:number;created_at:string;match_id:string|null;is_public:boolean;speaker_timeline?:unknown;description?:string|null;chat_log?:unknown};
export function VoiceReplays({hostId,matchId,mine=false,limit=50,publicOnly=false,reposts=false,focusId,feed=false}:{hostId?:string;matchId?:string;mine?:boolean;limit?:number;publicOnly?:boolean;reposts?:boolean;focusId?:string;feed?:boolean}) {
  const {user}=useAuth();const {lang}=useI18n();const label=(en:string,ar:string)=>lang==='ar'?ar:en;const qc=useQueryClient();
  const owner=mine?user?.id:hostId;const own=!!user&&owner===user.id;
  const [visibility,setVisibility]=useState<'all'|'public'|'private'>('all');const [editing,setEditing]=useState<Replay|null>(null);const [title,setTitle]=useState('');const [photo,setPhoto]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [desc,setDesc]=useState('');const [descAsked,setDescAsked]=useState<string|null>(null);const descRef=useRef<HTMLTextAreaElement>(null);
  const replays=useQuery({queryKey:['voice-replays',owner,matchId,limit,publicOnly,visibility,reposts,user?.id],enabled:!mine||!!user,queryFn:async()=>{
    let query=supabase.from('voice_recordings').select('id,host_id,title,cover_url,audio_url,duration_seconds,created_at,match_id,is_public,speaker_timeline,description,chat_log').order('created_at',{ascending:false}).limit(limit);
    if(owner&&!reposts)query=query.eq('host_id',owner);
    if(reposts&&owner){const {data,error}=await supabase.from('recording_interactions').select('recording_id').eq('user_id',owner).eq('kind','repost');if(error)throw error;if(!data?.length)return [];query=query.in('id',data.map(r=>r.recording_id));}
    if(matchId)query=query.eq('match_id',matchId);
    if(publicOnly)query=query.eq('is_public',true);else if(own&&visibility!=='all')query=query.eq('is_public',visibility==='public');
    const {data,error}=await query;if(error)throw error;return (data??[]) as Replay[];
  }});
  const refresh=async()=>{await qc.invalidateQueries({queryKey:['voice-replays']});await qc.invalidateQueries({queryKey:['profile']});};
  return <div className={feed?'-mx-4 h-[calc(100dvh-14rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain px-4':''} data-no-gesture={feed||undefined}>
    {own&&!publicOnly&&!reposts&&<div className="mb-3 flex gap-2">{(['all','public','private'] as const).map(v=><Button key={v} size="sm" variant={visibility===v?'secondary':'ghost'} onClick={()=>setVisibility(v)}>{v==='all'?label('All','الكل'):v==='public'?label('Public','عام'):label('Private','خاص')}</Button>)}</div>}
    {replays.isLoading&&<Loader2 className="mx-auto my-8 animate-spin"/>}{replays.isError&&<Button onClick={()=>void replays.refetch()}>{label('Try again','حاول مجددًا')}</Button>}
    {replays.data?.length===0&&<div className="py-14 text-center"><Mic className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="text-sm text-muted-foreground">{reposts?label('No reposts yet','لا توجد إعادة نشر بعد'):label('No recordings yet','لا توجد تسجيلات بعد')}</p></div>}
    {replays.data?.map(replay=><article key={replay.id} id={`recording-${replay.id}`} className={feed?'flex min-h-full snap-start flex-col justify-center border-b border-border py-6':'border-b border-border py-5'}>
      <div className="mb-3 flex items-start gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">{replay.cover_url?<img src={replay.cover_url} alt="" className="h-full w-full object-cover"/>:<Mic className="h-6 w-6 text-muted-foreground"/>}</div><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold">{replay.title}</h3><p className="mt-1 text-xs text-muted-foreground">{Math.floor(replay.duration_seconds/60)}:{String(Math.floor(replay.duration_seconds%60)).padStart(2,'0')} · {label('Published','نُشر')} {new Date(replay.created_at).toLocaleDateString(lang==='ar'?'ar':'en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>{replay.description&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{replay.description}</p>}{replay.host_id===user?.id&&<span className="text-xs text-muted-foreground">{replay.is_public?label('Published','منشور'):label('Private','خاص')}</span>}</div>{replay.host_id===user?.id&&<Button size="icon" variant="ghost" aria-label="Edit recording" onClick={()=>{setEditing(replay);setTitle(replay.title);setPhoto(null);setDesc(replay.description??'' );}}><Pencil/></Button>}</div>
      <ReplayAudio replay={replay} focus={focusId===replay.id}/>
      <RecordingSocial recordingId={replay.id} hostId={replay.host_id} title={replay.title}/>
      {replay.host_id===user?.id&&<div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={async()=>{if(!confirm(replay.is_public?label('Make this recording private?','جعل هذا التسجيل خاصًا؟'):label('Publish this recording to your profile?','نشر التسجيل على ملفك؟')))return;setBusy(true);const {error}=await supabase.from('voice_recordings').update({is_public:!replay.is_public}).eq('id',replay.id);if(error)toast.error('Could not update recording');else await refresh();setBusy(false);}}>{replay.is_public?label('Make private','جعله خاصًا'):label('Publish','نشر')}</Button><Button variant="ghost" size="icon" aria-label="Delete replay" disabled={busy} className="ml-auto text-destructive" onClick={async()=>{if(!confirm(label('Delete this recording?','حذف هذا التسجيل؟')))return;setBusy(true);const {error}=await supabase.from('voice_recordings').delete().eq('id',replay.id);if(error)toast.error('Could not delete');else await refresh();setBusy(false);}}><Trash2/></Button></div>}
    </article>)}
    <SocialScreen open={!!editing} title={label('Edit recording','تعديل التسجيل')} onClose={()=>{if(!busy)setEditing(null);}}><form className="space-y-5" onSubmit={async e=>{e.preventDefault();if(!editing||!user||!title.trim()||busy)return;setBusy(true);try{let cover=editing.cover_url;if(photo)cover=await uploadMedia('avatars',photo,user.id);const {error}=await supabase.from('voice_recordings').update({title:title.trim(),cover_url:cover}).eq('id',editing.id).eq('host_id',user.id);if(error)throw error;await refresh();setEditing(null);}catch{toast.error('Could not save recording');}finally{setBusy(false);}}}><label className="block text-sm">{label('Title','العنوان')}<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label><label className="block text-sm">{label('Photo','الصورة')}<input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]??null)} className="mt-2 block w-full text-base"/></label><Button type="submit" disabled={busy||!title.trim()} className="w-full">{label('Save changes','حفظ التغييرات')}</Button></form></SocialScreen>
  </div>;
}
function ReplayAudio({replay,focus}:{replay:Replay;focus:boolean}) {
  const ref=useRef<HTMLDivElement>(null);const {user}=useAuth();
  const audio=useQuery({queryKey:['recording-audio',replay.id,user?.id],staleTime:240000,queryFn:async()=>{
    const marker='/voice-recordings/';const index=replay.audio_url.indexOf(marker);if(index<0)throw new Error('Recording unavailable');const path=decodeURIComponent(replay.audio_url.slice(index+marker.length).split('?')[0]??'');const {data,error}=await supabase.storage.from('voice-recordings').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;
  }});
  useEffect(()=>{if(focus)ref.current?.scrollIntoView({block:'center'});},[focus]);
  return <div ref={ref}><RecordingPlayer src={audio.data} loading={audio.isLoading} failed={audio.isError} onRetry={()=>void audio.refetch()} duration={replay.duration_seconds} cover={replay.cover_url} timeline={replay.speaker_timeline} chat={replay.chat_log}/></div>;
}
