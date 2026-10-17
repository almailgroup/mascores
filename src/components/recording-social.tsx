import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Repeat2, Send, Trash2 } from 'lucide-react';
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

export function RecordingSocial({ recordingId, hostId, title }: { recordingId: string; hostId: string; title: string }) {
  const { user } = useAuth(); const signIn = useSignInAction(); const qc = useQueryClient();
  const { lang } = useI18n(); const label = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [commentsOpen,setCommentsOpen] = useState(false); const [shareOpen,setShareOpen] = useState(false);
  const [body,setBody] = useState(''); const [busy,setBusy] = useState(false);
  const interactions = useQuery({ queryKey: ['recording-social',recordingId,user?.id], queryFn: async () => {
    const { data,error } = await supabase.from('recording_interactions').select('*').eq('recording_id',recordingId).order('created_at');
    if (error) throw error;
    const ids = [...new Set((data ?? []).filter(i => i.kind === 'comment').map(i => i.user_id))];
    const { data: people } = ids.length ? await supabase.rpc('social_identity',{_ids:ids}) : { data: [] };
    return { rows: data ?? [], people: people ?? [] };
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
      <div className="space-y-5">{rows.filter(r => r.kind==='comment').map(r => { const person = interactions.data?.people.find(p => p.id===r.user_id); return <div key={r.id} className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><Link className="text-sm font-semibold" to="/u/$username" params={{username:person?.username ?? r.user_id}}>{person?.display_name ?? person?.username ?? label('User','مستخدم')}</Link><p className="whitespace-pre-wrap break-words text-sm">{r.body}</p><time className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</time></div>
        {(r.user_id===user?.id || hostId===user?.id) && <Button size="icon" variant="ghost" aria-label="Delete comment" onClick={async () => { if (!confirm(label('Delete this comment?','حذف هذا التعليق؟'))) return; const {error} = await supabase.from('recording_interactions').delete().eq('id',r.id); if(error) toast.error('Could not delete'); else await invalidate(); }}><Trash2/></Button>}
      </div>; })}</div>
      {!rows.some(r => r.kind==='comment') && <p className="py-10 text-center text-sm text-muted-foreground">{label('No comments yet','لا توجد تعليقات بعد')}</p>}
      {user ? <form className="sticky bottom-0 mt-6 flex items-end gap-2 border-t border-border bg-background py-3" onSubmit={async e => {
        e.preventDefault(); if (!body.trim() || busy) return; setBusy(true);
        const {error} = await supabase.from('recording_interactions').insert({recording_id:recordingId,user_id:user.id,kind:'comment',body:body.trim()});
        if(error) toast.error(label('Could not post comment','تعذر نشر التعليق')); else { setBody(''); await invalidate(); } setBusy(false);
      }}><textarea aria-label={label('Comment','تعليق')} maxLength={1000} rows={2} value={body} onChange={e=>setBody(e.target.value)} placeholder={label('Add a comment…','أضف تعليقًا…')} className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background p-3 text-base"/><Button type="submit" disabled={busy || !body.trim()} size="icon" aria-label={label('Post comment','نشر التعليق')}><Send/></Button></form> : <Button onClick={signIn}>{label('Sign in to comment','سجل الدخول للتعليق')}</Button>}
    </SocialScreen>
    <SocialShare open={shareOpen} onOpenChange={setShareOpen} title={title} url={url} onRepost={()=>void toggle('repost')}/>
  </>;
}