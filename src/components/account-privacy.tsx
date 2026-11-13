import { useState } from 'react';
import { Lock, Globe } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';

export function AccountPrivacy({ userId, isPublic, onChange }: { userId: string; isPublic: boolean; onChange?: (value: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { lang } = useI18n();
  const label = (en: string, ar: string) => lang === 'ar' ? ar : en;
  return <>
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2 text-sm">{isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{isPublic ? label('Public account','حساب عام') : label('Private account','حساب خاص')}</div>
      <Button variant="outline" onClick={() => setConfirming(true)}>{isPublic ? label('Make private','جعله خاصًا') : label('Make public','جعله عامًا')}</Button>
    </div>
    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent overlayClassName="z-[149] bg-foreground/50 backdrop-blur-sm" dir={lang === "ar" ? "rtl" : "ltr"} className="z-[150] w-[calc(100%-2rem)] max-w-md rounded-lg p-6 sm:p-7"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">{isPublic ? <Lock /> : <Globe />}</div>
      <DialogHeader><DialogTitle>{isPublic ? label('Switch to a private account?','تحويل الحساب إلى خاص؟') : label('Switch to a public account?','تحويل الحساب إلى عام؟')}</DialogTitle>
        <DialogDescription>{isPublic ? label('Only approved followers can see your published recordings. Existing followers stay.','يمكن للمتابعين المقبولين فقط رؤية تسجيلاتك المنشورة. يبقى المتابعون الحاليون.') : label('Anyone can see your published recordings. Pending follow requests will be accepted.','يمكن للجميع رؤية تسجيلاتك المنشورة. سيتم قبول طلبات المتابعة المعلقة.')}</DialogDescription>
      </DialogHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-border pt-5"><Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>{label('Cancel','إلغاء')}</Button><Button disabled={busy} onClick={async () => {
        setBusy(true);
        const { error } = await supabase.from('profiles').update({ is_public: !isPublic }).eq('id',userId);
        setBusy(false);
        if (error) { toast.error(label('Could not change privacy','تعذر تغيير الخصوصية')); return; }
        onChange?.(!isPublic); setConfirming(false); await qc.invalidateQueries({ queryKey: ['profile'] }); await qc.invalidateQueries({ queryKey: ['social-activity'] });
      }}>{label('Confirm','تأكيد')}</Button></div>
    </DialogContent></Dialog>
  </>;
}