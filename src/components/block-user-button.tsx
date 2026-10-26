import { useState } from 'react';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useSignInAction } from '@/lib/sign-in-action';
import { useI18n } from '@/lib/i18n';
import { useBlockedUsers } from '@/lib/blocks';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

export function BlockUserButton({ targetUserId, name }: { targetUserId: string; name: string }) {
  const { user } = useAuth(); const signIn = useSignInAction(); const { lang } = useI18n();
  const label = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const { isBlocked, block, unblock } = useBlockedUsers();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const blocked = isBlocked(targetUserId);
  const run = async () => {
    setBusy(true);
    try {
      if (blocked) { await unblock(targetUserId); toast.success(label('Account unblocked', 'تم إلغاء الحظر')); }
      else { await block(targetUserId); toast.success(label('Account blocked', 'تم حظر الحساب')); }
      setOpen(false);
    } catch { toast.error(label('Something went wrong. Please try again.', 'حدث خطأ. حاول مرة أخرى.')); }
    setBusy(false);
  };
  return <>
    <Button variant="ghost" size="icon" aria-label={blocked ? label('Unblock', 'إلغاء الحظر') : label('Block', 'حظر')} title={blocked ? label('Unblock', 'إلغاء الحظر') : label('Block', 'حظر')} onClick={() => { if (!user) { signIn(); return; } setOpen(true); }}><Ban className={`h-4 w-4 ${blocked ? 'text-destructive' : ''}`} /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="z-[150]" aria-describedby="block-description">
      <DialogTitle>{blocked ? label(`Unblock ${name}?`, `إلغاء حظر ${name}؟`) : label(`Block ${name}?`, `حظر ${name}؟`)}</DialogTitle>
      <DialogDescription id="block-description">{blocked
        ? label('They will be able to follow you and comment on your recordings again.', 'سيتمكن من متابعتك والتعليق على تسجيلاتك مجددًا.')
        : label("They won't be able to follow you or comment on your recordings, and you won't see their profile or comments. They won't be told. You can unblock them anytime in Settings.", 'لن يتمكن من متابعتك أو التعليق على تسجيلاتك، ولن ترى ملفه أو تعليقاته. لن يتم إشعاره. يمكنك إلغاء الحظر في أي وقت من الإعدادات.')}</DialogDescription>
      <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>{label('Cancel', 'إلغاء')}</Button><Button variant={blocked ? 'default' : 'destructive'} className="flex-1" disabled={busy} onClick={() => void run()}>{blocked ? label('Unblock', 'إلغاء الحظر') : label('Block', 'حظر')}</Button></div>
    </DialogContent></Dialog>
  </>;
}
