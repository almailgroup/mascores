import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function RecordingDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { lang } = useI18n();
  return <div className="mt-3">
    <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${expanded?'':'line-clamp-3'}`}>{text}</p>
    {(text.length>180||text.split('\n').length>3)&&<Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-xs text-muted-foreground" onClick={()=>setExpanded(!expanded)}>{lang==='ar'?(expanded?'عرض أقل':'المزيد'):(expanded?'Less':'More')}</Button>}
  </div>;
}