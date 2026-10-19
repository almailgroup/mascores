import { useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useSignInAction } from '@/lib/sign-in-action';
import { useI18n } from '@/lib/i18n';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

export function SocialReport({ targetUserId, recordingId, commentId }: { targetUserId: string; recordingId?: string; commentId?: string }) {
  const {user}=useAuth(); const signIn=useSignInAction(); const {lang}=useI18n();
  const label=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [open,setOpen]=useState(false); const [reason,setReason]=useState('spam'); const [details,setDetails]=useState(''); const [busy,setBusy]=useState(false);
  return <><Button variant="ghost" size="icon" aria-label={label('Report','إبلاغ')} title={label('Report','إبلاغ')} onClick={()=>{if(!user){signIn();return;}setOpen(true);}}><Flag className="h-4 w-4"/></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="z-[150] max-h-[90dvh] overflow-y-auto" aria-describedby="report-description"><DialogTitle>{commentId?label('Report comment','الإبلاغ عن التعليق'):recordingId?label('Report recording','الإبلاغ عن التسجيل'):label('Report profile','الإبلاغ عن الحساب')}</DialogTitle><DialogDescription id="report-description">{label('Your report is private and will be reviewed by our moderation team.','بلاغك خاص وسيتم مراجعته من فريق الإشراف.')}</DialogDescription>
      <form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(!user||busy)return;setBusy(true);const {error}=await supabase.from('social_reports').insert({reporter_id:user.id,target_user_id:targetUserId,recording_id:recordingId??null,comment_id:commentId??null,reason,details:details.trim()||null});setBusy(false);if(error){toast.error(label('Could not send report. Please try again.','تعذر إرسال البلاغ. حاول مرة أخرى.'));return;}setOpen(false);setDetails('');toast.success(label('Report submitted','تم إرسال البلاغ'));}}>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">{label('Reason','السبب')}</legend>{[['spam','Spam','رسائل مزعجة'],['harassment','Bullying or harassment','تنمر أو مضايقة'],['inappropriate','Inappropriate content','محتوى غير لائق'],['impersonation','Impersonation','انتحال شخصية'],['other','Something else','سبب آخر']].map(([value,en,ar])=><label key={value} className="flex items-center gap-3 py-2 text-sm"><input type="radio" name="reason" value={value} checked={reason===value} onChange={()=>setReason(value)} className="h-4 w-4 accent-primary"/>{label(en,ar)}</label>)}</fieldset>
        <label className="block text-sm">{label('Details (optional)','تفاصيل (اختياري)')}<textarea aria-label={label('Report details','تفاصيل البلاغ')} rows={3} maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-background p-3 text-base"/></label>
        <Button type="submit" disabled={busy} className="w-full">{label('Submit report','إرسال البلاغ')}</Button>
      </form></DialogContent></Dialog></>;
}