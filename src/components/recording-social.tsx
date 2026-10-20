import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Repeat2, Send, Trash2, X, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useSignInAction } from '@/lib/sign-in-action';
import { recordingShareUrl } from '@/lib/social';
import { SocialScreen } from './social-screen';
import { Button } from './ui/button';
import { SocialShare } from './social-share';
import { SocialReport } from './social-report';
import { useI18n } from '@/lib/i18n';
import { commentThreads, replyParent } from '@/lib/recording-comments';
import { useBlockedUsers } from '@/lib/blocks';

export function RecordingSocial({ recordingId, hostId, title }: { recordingId: string; hostId: string; title: string }) {
  const { user } = useAuth(); const signIn = useSignInAction(); const qc = useQueryClient();
  const { lang } = useI18n(); const label = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [commentsOpen,setCommentsOpen] = useState(false); const [shareOpen,setShareOpen] = useState(false);
  const [body,setBody] = useState(''); const [busy,setBusy] = useState(false);
  const [replyTo,setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const interactions = useQuery({ queryKey: ['recording-social',recordingId,user?.id], queryFn: async () => {
    const { data,error } = await supabase.from('recording_interactions').select('*').eq('recording_id',recordingId).order('created_at');
    if (error) throw error;
    const ids = [...new Set((data ?? []).filter(i => i.kind === 'comment').map(i => i.user_id))];
    const commentIds = (data ?? []).filter(i => i.kind === 'comment').map(i => i.id);
    const [identities, likes] = await Promise.all([
      ids.length ? supabase.rpc('social_identity',{_ids:ids}) : Promise.resolve({ data: [], error: null }),
      commentIds.length ? supabase.from('recording_comment_likes').select('comment_id,user_id').in('comment_id',commentIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (identities.error) throw identities.error;
    if (likes.error) throw likes.error;
    return { rows: data ?? [], people: identities.data ?? [], likes: likes.data ?? [] };
  }});
  const { isBlocked } = useBlockedUsers();
  // Blocked accounts' comments and reactions are hidden for the person who blocked them.
  const rows = (interactions.data?.rows ?? []).filter(r => !isBlocked(r.user_id));
  const host = useQuery({ queryKey: ['social-host',hostId], queryFn: async () => { const {data} = await supabase.rpc('social_identity',{_ids:[hostId]}); return data?.[0]; }});
  const invalidate = () => qc.invalidateQueries({queryKey:['recording-social',recordingId]});
  const toggle = async (kind: 'like'|'repost') => {
    if (!user) { signIn(); return; } if (busy) return;
    setBusy(true); const existing = rows.find(r => r.kind===kind && r.user_id===user.id);
    const { error } = existing ? await supabase.from('recording_interactions').delete().eq('id',existing.id) : await supabase.from('recording_interactions').insert({recording_id:recordingId,user_id:user.id,kind});
    if (error) toast.error(label('Could not save','تعذر الحفظ')); else await invalidate(); setBusy(false);
  };
  const url = recordingShareUrl(host.data?.username ?? hostId,recordingId);
  const ago = (iso: string) => {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    const [n, u] = s < 60 ? [s, 's'] : s < 3600 ? [Math.floor(s / 60), 'm'] : s < 86400 ? [Math.floor(s / 3600), 'h'] : s < 604800 ? [Math.floor(s / 86400), 'd'] : [Math.floor(s / 604800), 'w'];
    return `${n}${u}`;
  };
  const me = useQuery({ enabled: !!user, queryKey: ['shell-profile', user?.id], queryFn: async () => { const { data } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user!.id).maybeSingle(); return data; } });
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const commentView = (r: (typeof rows)[number], nested = false) => {
    const person = interactions.data?.people.find(p => p.id===r.user_id);
    const name = person?.username ?? person?.display_name ?? label('User','مستخدم');
    const likes = interactions.data?.likes.filter(l => l.comment_id===r.id) ?? [];
    const liked = likes.some(l => l.user_id===user?.id);
    const size = nested ? 'h-8 w-8' : 'h-10 w-10';
    return <div key={r.id} className={`flex items-start gap-3 ${nested ? 'ms-12' : ''}`}>
      <Link to="/u/$username" params={{username:person?.username ?? r.user_id}} className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted`} aria-label={name}>{person?.avatar_url?<img src={person.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound className="h-4 w-4 text-muted-foreground"/>}</Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm"><Link className="font-semibold" to="/u/$username" params={{username:person?.username ?? r.user_id}}>{name}</Link><time className="text-xs text-muted-foreground">{ago(r.created_at)}</time></div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">{r.body}</p>
        <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <button type="button" onClick={()=>{if(!user){signIn();return;}setReplyTo({id:replyParent(r),name});setOpenReplies(o=>({...o,[replyParent(r)]:true}));inputRef.current?.focus();}}>{label('Reply','رد')}</button>
          <SocialReport targetUserId={r.user_id} recordingId={recordingId} commentId={r.id}/>
          {(r.user_id===user?.id || hostId===user?.id) && <button type="button" aria-label={label('Delete comment','حذف التعليق')} onClick={async()=>{if(!confirm(label('Delete this comment and its replies?','حذف هذا التعليق وردوده؟')))return;const {error}=await supabase.from('recording_interactions').delete().eq('id',r.id);if(error)toast.error(label('Could not delete','تعذر الحذف'));else await invalidate();}}><Trash2 className="h-3.5 w-3.5"/></button>}
        </div>
      </div>
      <button type="button" aria-label={label('Like comment','إعجاب بالتعليق')} aria-pressed={liked} disabled={busy} className={`flex w-10 shrink-0 flex-col items-center pt-2 text-xs ${liked?'text-destructive':'text-muted-foreground'}`} onClick={async()=>{if(!user){signIn();return;}setBusy(true);try{const {error}=liked?await supabase.from('recording_comment_likes').delete().eq('comment_id',r.id).eq('user_id',user.id):await supabase.from('recording_comment_likes').insert({comment_id:r.id,user_id:user.id});if(error)throw error;await invalidate();}catch{toast.error(label('Could not save like','تعذر حفظ الإعجاب'));}finally{setBusy(false);}}}><Heart className={`h-5 w-5 ${liked?'fill-current':''}`}/>{likes.length ? <span className="mt-0.5">{likes.length.toLocaleString()}</span> : null}</button>
    </div>;
  };
  return <>
    <div className="flex items-center gap-2 pt-3" data-no-gesture>
      <Button variant="ghost" aria-label={label('Like','إعجاب')} aria-pressed={rows.some(r => r.kind==='like' && r.user_id===user?.id)} disabled={busy} onClick={() => void toggle('like')} className={rows.some(r => r.kind==='like' && r.user_id===user?.id) ? 'text-destructive' : ''}><Heart className={rows.some(r => r.kind==='like' && r.user_id===user?.id) ? 'fill-current' : ''}/>{rows.filter(r => r.kind==='like').length || ''}</Button>
      <Button variant="ghost" aria-label={label('Comments','التعليقات')} onClick={() => setCommentsOpen(true)}><MessageCircle/>{rows.filter(r => r.kind==='comment').length || ''}</Button>
      <Button variant="ghost" aria-label={label('Repost','إعادة نشر')} aria-pressed={rows.some(r => r.kind==='repost' && r.user_id===user?.id)} disabled={busy} className={rows.some(r => r.kind==='repost' && r.user_id===user?.id) ? 'text-primary' : ''} onClick={() => void toggle('repost')}><Repeat2/>{rows.filter(r => r.kind==='repost').length || ''}</Button>
      <Button variant="ghost" size="icon" className="ml-auto" aria-label={label('Share','مشاركة')} onClick={() => setShareOpen(true)}><Send/></Button>
      {user?.id!==hostId&&<SocialReport targetUserId={hostId} recordingId={recordingId}/>}
    </div>
    <SocialScreen open={commentsOpen} title={label('Comments','التعليقات')} onClose={() => setCommentsOpen(false)}>
      <h2 className="mb-5 text-sm font-semibold">{title}</h2>
      {interactions.isError&&<Button variant="outline" onClick={()=>void interactions.refetch()}>{label('Try again','حاول مجددًا')}</Button>}
      <div className="space-y-5">{commentThreads(rows.filter(r=>r.kind==='comment')).map(({root,replies})=><div key={root.id} className="space-y-3">{commentView(root)}{replies.map(r=>commentView(r,true))}</div>)}</div>
      {!rows.some(r => r.kind==='comment') && <p className="py-10 text-center text-sm text-muted-foreground">{label('No comments yet','لا توجد تعليقات بعد')}</p>}
      {user ? <form className="sticky bottom-0 mt-6 border-t border-border bg-background py-3" onSubmit={async e => {
        e.preventDefault(); if (!body.trim() || busy) return; setBusy(true);
        const {error} = await supabase.from('recording_interactions').insert({recording_id:recordingId,user_id:user.id,kind:'comment',body:body.trim(),parent_comment_id:replyTo?.id??null});
        if(error) toast.error(label('Could not post comment','تعذر نشر التعليق')); else { setBody('');setReplyTo(null); await invalidate(); } setBusy(false);
      }}>{replyTo&&<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{label('Replying to','الرد على')} {replyTo.name}</span><Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={label('Cancel reply','إلغاء الرد')} onClick={()=>setReplyTo(null)}><X className="h-4 w-4"/></Button></div>}
        <div className="mb-3 flex justify-between px-1">{['❤️','🙌','🔥','👏','😢','😍','😮','😂'].map(e=><button key={e} type="button" className="text-2xl" aria-label={e} onClick={()=>{setBody(b=>b+e);inputRef.current?.focus();}}>{e}</button>)}</div>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{me.data?.avatar_url?<img src={me.data.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound className="h-4 w-4 text-muted-foreground"/>}</div>
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-border bg-background ps-4 pe-1"><textarea ref={inputRef} aria-label={label('Comment','تعليق')} maxLength={1000} rows={1} value={body} onChange={e=>setBody(e.target.value)} placeholder={replyTo?label('Write a reply…','اكتب ردًا…'):label('Join the conversation…','شارك في الحديث…')} className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base outline-none"/>{body.trim()&&<Button type="submit" disabled={busy} size="sm" variant="ghost" className="rounded-full font-semibold text-primary">{label('Post','نشر')}</Button>}</div></div></form> : <Button onClick={signIn}>{label('Sign in to comment','سجل الدخول للتعليق')}</Button>}
    </SocialScreen>
    <SocialShare open={shareOpen} onOpenChange={setShareOpen} title={title} url={url} onRepost={()=>void toggle('repost')}/>
  </>;
}