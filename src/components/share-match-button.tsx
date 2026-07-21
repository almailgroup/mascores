import { Share2, Check, Copy, Download } from "lucide-react";
import { useState } from "react";

export function ShareMatchButton({ matchId, title }: { matchId: number; title: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/matches/${matchId}` : `/matches/${matchId}`;
  const imgUrl = `/api/public/share/match/${matchId}`;

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text: title, url: shareUrl });
        return;
      } catch { /* fall through to menu */ }
    }
    setOpen((v) => !v);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={nativeShare}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/50 hover:text-primary"
        aria-label="Share match"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <button onClick={copyLink} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          <a href={imgUrl} target="_blank" rel="noreferrer" download={`match-${matchId}.svg`} className="flex items-center gap-2 border-t border-border px-3 py-2 text-sm hover:bg-muted">
            <Download className="h-4 w-4" /> Download share image
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="block border-t border-border px-3 py-2 text-sm hover:bg-muted">Share on X</a>
          <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${shareUrl}`)}`} target="_blank" rel="noreferrer" className="block border-t border-border px-3 py-2 text-sm hover:bg-muted">Share on WhatsApp</a>
        </div>
      )}
    </div>
  );
}