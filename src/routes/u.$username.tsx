import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Lock, BadgeCheck, UserRound, Settings, Grid3X3, Repeat2 } from 'lucide-react';
import { AppShell, BackButton } from '@/components/app-shell';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { VoiceReplays } from '@/components/voice-replays';
import { VoiceBadge } from '@/components/voice-people';
import { SocialScreen } from '@/components/social-screen';
import { AccountPrivacy } from '@/components/account-privacy';
import { SocialActivityButton } from '@/components/social-activity';
import { SocialReport } from '@/components/social-report';
import { SocialShare } from '@/components/social-share';
import { BlockUserButton } from '@/components/block-user-button';
import { useBlockedUsers } from '@/lib/blocks';
import { Button } from '@/components/ui/button';
import { useSignInAction } from '@/lib/sign-in-action';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

export const Route = createFileRoute('/u/$username')({
  validateSearch: (search: Record<string, unknown>): { recording?: string } => ({ recording: typeof search.recording === 'string' ? search.recording : undefined }),
  head: ({ params }) => ({meta:[{title:`@${params.username} — MA Scores`},{name:'description',content:`Football profile and recordings from @${params.username} on MA Scores.`},{property:'og:title',content:`@${params.username} — MA Scores`},{property:'og:description',content:'Recordings, followers and football conversations.'},{property:'og:type',content:'profile'},{name:'twitter:card',content:'summary'}]}),
  component: ProfilePage,
});
type Person = {id:string; username:string|null; display_name:string|null; avatar_url:string|null};
type Profile = Person & {bio:string|null;is_public:boolean;can_view:boolean;followers:number|null;following:number|null;recordings:number;badge:string|null;hide_follows?:boolean};
function FollowList({userId,kind,onClose}:{userId:string;kind:'followers'|'following';onClose:()=>void}) {
  const [q,setQ]=useState(''); const {lang}=useI18n();
  const people=useQuery({queryKey:['follow-list',userId,kind],queryFn:async()=>{const {data,error}=await supabase.rpc('social_follow_list',{_user:userId,_kind:kind});if(error)throw error;return data??[];}});
  const list=(people.data??[]).filter(p=>`${p.display_name??''} ${p.username??''}`.toLowerCase().includes(q.toLowerCase().trim()));
  return <SocialScreen open title={kind==='followers'?(lang==='ar'?'المتابعون':'Followers'):(lang==='ar'?'يتابع':'Following')} onClose={onClose}>
    <input autoFocus aria-label="Search users" placeholder={lang==='ar'?'البحث عن أشخاص…':'Search people…'} value={q} onChange={e=>setQ(e.target.value)} className="mb-5 w-full rounded-md border border-border bg-muted px-4 py-3 text-base"/>
    {people.isLoading&&<Loader2 className="mx-auto animate-spin"/>}
    {people.isError&&<Button onClick={()=>void people.refetch()}>Try again</Button>}
    {list.map(p=><Link key={p.id} to="/u/$username" params={{username:p.username??p.id}} onClick={onClose} className="flex items-center gap-3 py-3">
      <Avatar person={p}/><div className="min-w-0 flex-1"><div className="break-words text-sm font-semibold">{p.display_name??p.username}</div><div className="text-sm text-muted-foreground">@{p.username}</div></div>
    </Link>)}{!people.isLoading&&list.length===0&&<p className="py-10 text-center text-sm text-muted-foreground">{lang==='ar'?'لا توجد نتائج':'No people found'}</p>}
  </SocialScreen>;
}
function Avatar({person,large=false}:{person:Person;large?:boolean}) {
  const [failed,setFailed]=useState(false);
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${large?'h-20 w-20 sm:h-28 sm:w-28':'h-11 w-11'}`}>{person.avatar_url&&!failed?<img alt="" src={person.avatar_url} onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:<UserRound className={large?'h-9 w-9 text-muted-foreground':'h-5 w-5 text-muted-foreground'}/>}</div>;
}
function ProfilePage() {
  const {username}=Route.useParams(); const {recording}=Route.useSearch(); const {user}=useAuth();const qc=useQueryClient(); const signIn=useSignInAction();const {lang}=useI18n();const label=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [followList,setFollowList]=useState<'followers'|'following'|null>(null);const [editing,setEditing]=useState(false);const [name,setName]=useState('');const [bio,setBio]=useState('');const [saving,setSaving]=useState(false);const [followBusy,setFollowBusy]=useState(false);const [tab,setTab]=useState<'recordings'|'reposts'>('recordings');
  const [shareOpen,setShareOpen]=useState(false);const [phone,setPhone]=useState('');const [email,setEmail]=useState('');
  const profile=useQuery({queryKey:['profile',username,user?.id],queryFn:async()=>{const {data,error}=await supabase.rpc('social_profile',{_username:username});if(error)throw error;return data as Profile|null;}});
  const target=profile.data;const own=target?.id===user?.id;const {isBlocked}=useBlockedUsers();const blocked=!own&&isBlocked(target?.id);
  const relationship=useQuery({queryKey:['social-follow',user?.id,target?.id],enabled:!!user&&!!target&&!own,queryFn:async()=>{if(!user||!target)return {following:false,requested:false};const [f,r]=await Promise.all([supabase.from('profile_follows').select('id').eq('follower_id',user.id).eq('following_id',target.id).maybeSingle(),supabase.from('follow_requests').select('id').eq('requester_id',user.id).eq('target_id',target.id).maybeSingle()]);if(f.error||r.error)throw f.error??r.error;return {following:!!f.data,requested:!!r.data};}});
  const toggleFollow=async()=>{
    if(!user){signIn();return;}if(!target||followBusy)return;setFollowBusy(true);
    const f=relationship.data?.following;const requested=relationship.data?.requested;
    const result=f?await supabase.from('profile_follows').delete().eq('follower_id',user.id).eq('following_id',target.id):requested?await supabase.from('follow_requests').delete().eq('requester_id',user.id).eq('target_id',target.id):target.is_public?await supabase.from('profile_follows').insert({follower_id:user.id,following_id:target.id}):await supabase.from('follow_requests').insert({requester_id:user.id,target_id:target.id});
    if(result.error)toast.error(label('Could not update follow','تعذر تحديث المتابعة'));else {await qc.invalidateQueries({queryKey:['social-follow']});await qc.invalidateQueries({queryKey:['profile']});}setFollowBusy(false);
  };
  if(profile.isLoading)return <AppShell><Loader2 className="mx-auto my-16 animate-spin"/></AppShell>;
  if(profile.isError)return <AppShell><BackButton/><Button onClick={()=>void profile.refetch()}>Try again</Button></AppShell>;
  if(!target)return <AppShell><BackButton/><p className="py-12 text-center">{label('Profile not found','الحساب غير موجود')}</p></AppShell>;
  return <AppShell>
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 flex items-center gap-2"><BackButton iconOnly/><div className="flex min-w-0 flex-1 items-center gap-1.5"><h1 className="min-w-0 break-words text-lg font-bold">{!target.is_public&&<Lock className="mr-1 inline h-4 w-4"/>}{target.username}</h1><VoiceBadge badge={target.badge}/></div>{own&&<><SocialActivityButton/><Button asChild variant="ghost" size="icon" aria-label={label('Settings','الإعدادات')}><Link to="/settings"><Settings/></Link></Button></>}</header>
      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-8">
        <Avatar person={target} large/>
        <div className="grid min-w-0 grid-cols-3 gap-1 text-center">
          <div className="flex h-16 min-w-0 flex-col items-center justify-center gap-1"><span className="block w-full text-center text-lg font-bold leading-6 tabular-nums">{target.recordings}</span><span className="block w-full text-center text-xs font-normal leading-4">{label('recordings','تسجيلات')}</span></div>
          <Button variant="ghost" className="flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-0 py-0 disabled:opacity-100" disabled={(!target.can_view&&!own)||!!target.hide_follows} onClick={()=>setFollowList('followers')}><span className="block w-full text-center text-lg font-bold leading-6 tabular-nums">{target.hide_follows?<Lock className="mx-auto h-4 w-4"/>:target.followers}</span><span className="block w-full text-center text-xs font-normal leading-4">{label('followers','متابعون')}</span></Button>
          <Button variant="ghost" className="flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-0 py-0 disabled:opacity-100" disabled={(!target.can_view&&!own)||!!target.hide_follows} onClick={()=>setFollowList('following')}><span className="block w-full text-center text-lg font-bold leading-6 tabular-nums">{target.hide_follows?<Lock className="mx-auto h-4 w-4"/>:target.following}</span><span className="block w-full text-center text-xs font-normal leading-4">{label('following','يتابع')}</span></Button>
        </div>
      </div>
      <div className="mt-4"><h2 className="min-w-0 break-words text-base font-bold [overflow-wrap:anywhere]">{target.display_name??target.username}</h2>{target.bio&&<p className="mt-1 whitespace-pre-wrap break-words text-sm">{target.bio}</p>}<PublicContacts userId={target.id}/></div>
      <div className="my-5 flex gap-2" data-no-gesture>{own?<><Button variant="secondary" className="flex-1" onClick={async()=>{setName(target.display_name??'');setBio(target.bio??'');setEditing(true);if(user){const {data}=await supabase.from('profile_contacts').select('phone,email').eq('user_id',user.id).maybeSingle();setPhone(data?.phone??'');setEmail(data?.email??user.email??'');}}}>{label('Edit profile','تعديل الملف الشخصي')}</Button><Button asChild variant="outline" className="flex-1"><Link to="/verify"><BadgeCheck/>{label('Verification','التوثيق')}</Link></Button></>:<><Button className="flex-1" variant={relationship.data?.following||relationship.data?.requested?'secondary':'default'} disabled={followBusy||relationship.isLoading} onClick={()=>void toggleFollow()}>{followBusy?<Loader2 className="animate-spin"/>:relationship.data?.following?label('Following','يتابع'):relationship.data?.requested?label('Requested','تم الطلب'):label('Follow','متابعة')}</Button><Button variant="outline" size="icon" aria-label="Share profile" onClick={()=>setShareOpen(true)}><Repeat2/></Button><SocialReport targetUserId={target.id}/><BlockUserButton targetUserId={target.id} name={target.display_name??target.username??''}/></>}</div>
      {own&&<Link to="/notifications" className="mb-5 block text-sm font-semibold text-primary">{label('Follow requests and activity','طلبات المتابعة والإشعارات')}</Link>}
      {blocked?<div className="border-t border-border py-14 text-center"><h2 className="font-bold">{label('You blocked this account','لقد حظرت هذا الحساب')}</h2><p className="mt-2 text-sm text-muted-foreground">{label('Unblock to see their recordings again.','ألغِ الحظر لرؤية تسجيلاته مجددًا.')}</p></div>:target.can_view||own?<><div className="mb-5 grid grid-cols-2 border-y border-border"><Button variant="ghost" className={`h-12 rounded-none ${tab==='recordings'?'border-b-2 border-foreground':'text-muted-foreground'}`} aria-label="Recordings" onClick={()=>setTab('recordings')}><Grid3X3/>{label('Recordings','التسجيلات')}</Button><Button variant="ghost" className={`h-12 rounded-none ${tab==='reposts'?'border-b-2 border-foreground':'text-muted-foreground'}`} aria-label="Reposts" onClick={()=>setTab('reposts')}><Repeat2/>{label('Reposts','إعادة النشر')}</Button></div><VoiceReplays hostId={target.id} publicOnly={!own} reposts={tab==='reposts'} focusId={recording}/></>:<div className="border-t border-border py-14 text-center"><Lock className="mx-auto mb-3 h-10 w-10"/><h2 className="font-bold">{label('This account is private','هذا الحساب خاص')}</h2><p className="mt-2 text-sm text-muted-foreground">{label('Follow this account to see their recordings.','تابع هذا الحساب لرؤية تسجيلاته.')}</p></div>}
      <SocialShare open={shareOpen} onOpenChange={setShareOpen} title={target.display_name??target.username??'MA Scores'} url={`https://mascores.live/u/${encodeURIComponent(target.username??target.id)}`}/>
      {followList&&<FollowList userId={target.id} kind={followList} onClose={()=>setFollowList(null)}/>}
      <SocialScreen open={editing} title={label('Edit profile','تعديل الملف الشخصي')} onClose={()=>{if(!saving)setEditing(false);}}>
        <div className="mb-6 flex items-center gap-4"><Avatar person={target}/><Button asChild variant="link"><Link to="/settings" onClick={()=>setEditing(false)}>{label('Change profile photo','تغيير صورة الملف')}</Link></Button></div>
        <form onSubmit={async e=>{e.preventDefault();if(!user||saving)return;setSaving(true);if(email.trim()&&!/^\S+@\S+\.\S+$/.test(email.trim())){setSaving(false);toast.error(label('Enter a valid email','أدخل بريدًا صحيحًا'));return;}await supabase.from('profile_contacts').upsert({user_id:user.id,phone:phone.trim()||null,email:email.trim()||null,updated_at:new Date().toISOString()});const {error}=await supabase.from('profiles').update({display_name:name.trim()||null,bio:bio.trim()||null}).eq('id',user.id);setSaving(false);if(error){toast.error(error.message.startsWith('DISPLAY_COOLDOWN')?label('You can change your display name once every 2 days.','يمكن تغيير الاسم الظاهر مرة كل يومين.'):label('Could not save profile','تعذر حفظ الملف'));return;}await qc.invalidateQueries({queryKey:['profile']});setEditing(false);}} className="space-y-5">
          <label className="block text-sm font-medium">{label('Name','الاسم')}<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label>
          <label className="block text-sm font-medium">{label('Bio','النبذة')}<textarea rows={4} maxLength={500} value={bio} onChange={e=>setBio(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label>
          <label className="block text-sm font-medium">{label('Phone number','رقم الهاتف')}<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={40} placeholder="+965…" className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label>
          <label className="block text-sm font-medium">{label('Email','البريد الإلكتروني')}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={160} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label>
          <p className="text-xs text-muted-foreground">{label('Shown on your profile. Leave empty to hide.','يظهر في ملفك الشخصي. اتركه فارغاً لإخفائه.')}</p>
          <Button type="submit" className="w-full" disabled={saving}>{saving?<Loader2 className="animate-spin"/>:label('Save changes','حفظ التغييرات')}</Button>
        </form>
        {user&&<div className="mt-6 border-y border-border"><AccountPrivacy userId={user.id} isPublic={target.is_public}/></div>}
        <Button asChild variant="link" className="mt-4 px-0"><Link to="/verify"><BadgeCheck/>{label('Request verification','طلب التوثيق')}</Link></Button>
      </SocialScreen>
    </div>
  </AppShell>;
}

function PublicContacts({userId}:{userId:string}){const q=useQuery({queryKey:['profile','contacts',userId],queryFn:async()=>{const {data}=await supabase.rpc('public_contacts',{_user:userId});return (data as {phone:string|null;email:string|null}[]|null)?.[0]??null;}});const c=q.data;if(!c||(!c.phone&&!c.email))return null;return <div className="mt-2 flex flex-col gap-1 text-sm" data-no-gesture>{c.phone&&<a href={`tel:${c.phone}`} className="text-primary break-all">📞 {c.phone}</a>}{c.email&&<a href={`mailto:${c.email}`} className="text-primary break-all">✉️ {c.email}</a>}</div>;}
