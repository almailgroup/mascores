import { Copy, Link2, Repeat2, Share2 } from 'lucide-react';
import { siWhatsapp, siSnapchat, siX } from 'simple-icons';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

function BrandIcon({path}:{path:string}) { return <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true"><path d={path}/></svg>; }
export function SocialShare({open,onOpenChange,title,url,onRepost}:{open:boolean;onOpenChange:(value:boolean)=>void;title:string;url:string;onRepost?:()=>void}) {
  const {lang}=useI18n(); const label=(en:string,ar:string)=>lang==='ar'?ar:en;
  const native=async()=>{if(!navigator.share){toast.info(label('Use Copy link to share in your app.','انسخ الرابط لمشاركته في تطبيقك.'));return;}try{await navigator.share({title,url});}catch(error){if(!(error instanceof Error&&error.name==='AbortError'))toast.error(label('Could not share','تعذرت المشاركة'));}};
  const copy=async()=>{try{await navigator.clipboard.writeText(url);toast.success(label('Link copied','تم نسخ الرابط'));}catch{toast.error(label('Could not copy link','تعذر نسخ الرابط'));}};
  const item='flex h-auto w-[88px] shrink-0 flex-col justify-start gap-3 rounded-none p-0 text-center hover:bg-transparent';
  const circle='flex h-16 w-16 shrink-0 items-center justify-center rounded-full';
  const text='block min-h-10 w-full text-center text-sm font-semibold leading-5 whitespace-normal';
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent aria-describedby={undefined} className="top-auto bottom-0 max-w-none translate-y-0 gap-5 rounded-t-lg border-x-0 border-b-0 px-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:bottom-auto sm:top-1/2 sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-lg">
    <DialogTitle className="px-6 text-center">{label('Share','مشاركة')}</DialogTitle>
    <div className="flex items-start gap-3 overflow-x-auto px-5 pb-1" data-no-gesture>
      {onRepost&&<Button variant="ghost" className={item} onClick={()=>{onRepost();onOpenChange(false);}}><span className={`${circle} bg-share-yellow text-share-white`}><Repeat2 className="h-9 w-9"/></span><span className={text}>{label('Repost','إعادة نشر')}</span></Button>}
      <Button asChild variant="ghost" className={item}><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(title+' '+url)}`}><span className={`${circle} bg-share-whatsapp text-share-white`}><BrandIcon path={siWhatsapp.path}/></span><span className={text}>WhatsApp</span></a></Button>
      <Button variant="ghost" className={item} onClick={()=>void native()}><span className={`${circle} bg-share-yellow text-share-ink`}><BrandIcon path={siSnapchat.path}/></span><span className={text}>Snapchat<br/>Chats</span></Button>
      <Button variant="ghost" className={item} onClick={()=>void copy()}><span className={`${circle} bg-share-link text-share-white`}><Link2 className="h-9 w-9"/></span><span className={text}>{label('Copy link','نسخ الرابط')}</span></Button>
      <Button asChild variant="ghost" className={item}><a target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}><span className={`${circle} bg-share-ink text-share-white`}><BrandIcon path={siX.path}/></span><span className={text}>X</span></a></Button>
      <Button asChild variant="ghost" className={item}><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(title+' '+url)}`}><span className={`${circle} bg-share-whatsapp text-share-white`}><span className="relative"><BrandIcon path={siWhatsapp.path}/><span className="absolute -right-2 -top-3 text-xl font-bold">+</span></span></span><span className={text}>WA<br/>Business</span></a></Button>
      <Button variant="ghost" className={item} onClick={()=>void native()}><span className={`${circle} bg-muted text-foreground`}><Share2 className="h-8 w-8"/></span><span className={text}>{label('Other apps','تطبيقات أخرى')}</span></Button>
    </div>
  </DialogContent></Dialog>;
}