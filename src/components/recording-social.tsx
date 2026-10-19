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
  const rows = interactions.data?.rows ?? [];
  const host = useQuery({ queryKey: ['social-host',hostId], queryFn: async () => { const {data} = await supabase.rpc('social_identity',{_ids:[hostId]}); return data?.[0]; }});
  const invalidate = () => qc.invalidateQueries({queryKey:['recording-social',recordingId]});
  const toggle = async (kind: 'like'|'repost') => {
    if (!user) { signIn(); return; } if (busy) return;
    setBusy(true); const existing = rows.find(r => r.kind===kind && r.user_id===user.id);
    const { error } = existing ? await supabase.from('recording_interactions').delete().eq('id',existing.id) : await supabase.from('recording_interactions').insert({recording_id:recordingId,user_id:user.id,kind});
    if (error) toast.error(label('Could not save','تعذر الحفظ')); else await invalidate(); setBusy(false);
  };
  const url = recordingShareUrl(host.data?.username ?? hostId,recordingId);
  const commentView = (r: (typeof rows)[number], nested = false) => {
    const person = interactions.data?.people.find(p => p.id===r.user_id);
    const name = person?.display_name ?? person?.username ?? label('User','مستخدم');
    const likes = interactions.data?.likes.filter(l => l.comment_id===r.id) ?? [];
    const liked = likes.some(l => l.user_id===user?.id);
    return <div key={r.id} className={`flex items-start gap-3 ${nested ? 'ms-10 border-s border-border ps-3' : ''}`}>
      <Link to="/u/$username" params={{username:person?.username ?? r.user_id}} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted" aria-label={name}>{person?.avatar_url?<img src={person.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound className="h-4 w-4 text-muted-foreground"/>}</Link>
      <div className="min-w-0 flex-1"><Link className="text-sm font-semibold" to="/u/$username" params={{username:person?.username ?? r.user_id}}>{name}</Link><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{r.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1"><time className="me-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</time>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={()=>{if(!user){signIn();return;}setReplyTo({id:replyParent(r),name});inputRef.current?.focus();}}>{label('Reply','رد')}</Button>
          <Button size="sm" variant="ghost" aria-label={label('Like comment','إعجاب بالتعليق')} aria-pressed={liked} disabled={busy} className={`h-8 gap-1 px-2 ${liked?'text-destructive':'text-muted-foreground'}`} onClick={async()=>{if(!user){signIn();return;}setBusy(true);try{const {error}=liked?await supabase.from('recording_comment_likes').delete().eq('comment_id',r.id).eq('user_id',user.id):await supabase.from('recording_comment_likes').insert({comment_id:r.id,user_id:user.id});if(error)throw error;await invalidate();}catch{toast.error(label('Could not save like','تعذر حفظ الإعجاب'));}finally{setBusy(false);}}}><Heart className={`h-4 w-4 ${liked?'fill-current':''}`}/>{likes.length||''}</Button>
          <SocialReport targetUserId={r.user_id} recordingId={recordingId} commentId={r.id}/>
          {(r.user_id===user?.id || hostId===user?.id) && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={label('Delete comment','حذف التعليق')} onClick={async()=>{if(!confirm(label('Delete this comment and its replies?','حذف هذا التعليق وردوده؟')))return;const {error}=await supabase.from('recording_interactions').delete().eq('id',r.id);if(error)toast.error(label('Could not delete','تعذر الحذف'));else await invalidate();}}><Trash2 className="h-4 w-4"/></Button>}
        </div>
      </div>
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
      }}>{replyTo&&<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{label('Replying to','الرد على')} {replyTo.name}</span><Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={label('Cancel reply','إلغاء الرد')} onClick={()=>setReplyTo(null)}><X className="h-4 w-4"/></Button></div>}<div className="flex items-end gap-2"><textarea ref={inputRef} aria-label={label('Comment','تعليق')} maxLength={1000} rows={2} value={body} onChange={e=>setBody(e.target.value)} placeholder={replyTo?label('Write a reply…','اكتب ردًا…'):label('Add a comment…','أضف تعليقًا…')} className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background p-3 text-base"/><Button type="submit" disabled={busy || !body.trim()} size="icon" aria-label={label('Post comment','نشر التعليق')}><Send/></Button></div></form> : <Button onClick={signIn}>{label('Sign in to comment','سجل الدخول للتعليق')}</Button>}
    </SocialScreen>
    <SocialShare open={shareOpen} onOpenChange={setShareOpen} title={title} url={url} onRepost={()=>void toggle('repost')}/>
  </>;
}