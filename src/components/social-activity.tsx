import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, UserRound, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/lib/i18n';
import { socialMessage, type SocialKind } from '@/lib/social';
import { Button } from './ui/button';

export function useSocialActivity() {
  const { user } = useAuth(); const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`social-${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'social_notifications',filter:`recipient_id=eq.${user.id}`},() => { void qc.invalidateQueries({queryKey:['social-activity']}); }).on('postgres_changes',{event:'*',schema:'public',table:'follow_requests',filter:`target_id=eq.${user.id}`},() => { void qc.invalidateQueries({queryKey:['social-activity']}); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  },[user?.id,qc]);
  return useQuery({queryKey:['social-activity',user?.id],enabled:!!user,queryFn:async () => {
    if (!user) return { notifications:[],requests:[],people:[] };
    const [activity,requests] = await Promise.all([supabase.from('social_notifications').select('*').eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(100),supabase.from('follow_requests').select('*').eq('target_id',user.id).order('created_at',{ascending:false})]);
    if(activity.error || requests.error) throw activity.error ?? requests.error;
    const ids = [...new Set([...(activity.data??[]).map(n=>n.actor_id),...(requests.data??[]).map(r=>r.requester_id)])];
    const {data:people} = ids.length ? await supabase.rpc('social_identity',{_ids:ids}) : {data:[]};
    return {notifications:activity.data??[],requests:requests.data??[],people:people??[]};
  }});
}

export function SocialActivityButton() {
  const activity = useSocialActivity(); const {lang} = useI18n();
  const unread = activity.data?.notifications.filter(n=>!n.read_at).length ?? 0;
  return <Button asChild size="icon" variant="ghost" className="relative" aria-label={lang==='ar'?'الإشعارات':'Notifications'}><Link to="/notifications"><Bell/>{unread>0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold text-destructive-foreground">{unread>99?'99+':unread}</span>}</Link></Button>;
}

export function SocialActivity() {
  const activity = useSocialActivity(); const {user} = useAuth(); const qc=useQueryClient(); const {lang}=useI18n();
  const label=(en:string,ar:string)=>lang==='ar'?ar:en;
  const person=(id:string)=>activity.data?.people.find(p=>p.id===id);
  return <div className="mx-auto max-w-2xl">
    <div className="mb-5 flex items-center justify-between gap-3"><h1 className="text-xl font-bold">{label('Notifications','الإشعارات')}</h1><Button asChild variant="ghost" size="sm"><Link to="/settings">{label('Settings','الإعدادات')}</Link></Button></div>
    {!user ? <Button asChild><Link to="/auth">{label('Sign in','تسجيل الدخول')}</Link></Button> : <>
      {!!activity.data?.requests.length && <section className="mb-6"><h2 className="mb-3 text-sm font-bold">{label('Follow requests','طلبات المتابعة')} ({activity.data.requests.length})</h2>{activity.data.requests.map(r=>{const p=person(r.requester_id); return <div key={r.id} className="flex items-center gap-2 border-b border-border py-3"><Link to="/u/$username" params={{username:p?.username??r.requester_id}} className="min-w-0 flex-1 break-words text-sm font-semibold">{p?.display_name??p?.username??label('User','مستخدم')}</Link>{[true,false].map(accept=><Button key={String(accept)} variant={accept?'default':'outline'} size="icon" aria-label={accept?label('Accept','قبول'):label('Decline','رفض')} onClick={async()=>{const {error}=await supabase.rpc('respond_follow_request',{_request:r.id,_accept:accept});if(error)toast.error('Could not update request');else {await qc.invalidateQueries({queryKey:['social-activity']});await qc.invalidateQueries({queryKey:['profile']});}}>{accept?<Check/>:<X/>}</Button>)}</div>;})}</section>}
      <div className="mb-3 flex justify-end"><Button variant="ghost" size="sm" onClick={async()=>{const {error}=await supabase.from('social_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).is('read_at',null);if(error)toast.error('Could not mark notifications read');else await qc.invalidateQueries({queryKey:['social-activity']});}}>{label('Mark all read','قراءة الكل')}</Button></div>
      {activity.isLoading && <p className="py-10 text-center text-muted-foreground">…</p>}
      {activity.isError && <Button onClick={()=>void activity.refetch()}>{label('Try again','حاول مجددًا')}</Button>}
      {activity.data?.notifications.map(n=>{const p=person(n.actor_id);return <div key={n.id} className={`flex items-start gap-3 border-b border-border p-3 ${!n.read_at?'bg-accent/50':''}`}>
        <Link to="/u/$username" params={{username:p?.username??n.actor_id}} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{p?.avatar_url?<img src={p.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound className="h-5 w-5"/>}</Link>
        <div className="min-w-0 flex-1"><Link to="/u/$username" params={{username:p?.username??n.actor_id}} className="text-sm font-bold">{p?.display_name??p?.username??label('User','مستخدم')}</Link><p className="text-sm">{socialMessage(n.kind as SocialKind,lang==='ar')}</p><time className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString(lang==='ar'?'ar':'en')}</time>
          {n.recording_id && <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0"><Link to="/u/$username" params={{username:user.id}} search={{recording:n.recording_id}}>{label('View recording','عرض التسجيل')}</Link></Button>}
        </div>{!n.read_at&&<Button variant="ghost" size="icon" aria-label={label('Mark read','تحديد كمقروء')} onClick={async()=>{await supabase.from('social_notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);await qc.invalidateQueries({queryKey:['social-activity']});}}><Check/></Button>}
      </div>;})}
      {activity.data?.notifications.length===0 && <div className="py-16 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="text-sm text-muted-foreground">{label('No activity yet','لا توجد إشعارات بعد')}</p></div>}
    </>}
  </div>;
}