import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function SocialScreen({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent aria-describedby={undefined} className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none [&>button]:hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button size="icon" variant="ghost" aria-label="Back" onClick={onClose}><ArrowLeft /></Button>
        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"><div className="mx-auto w-full max-w-2xl">{children}</div></div>
    </DialogContent>
  </Dialog>;
}