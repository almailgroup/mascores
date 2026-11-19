import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Mail, Instagram, Languages } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

const APP_STORE = "https://apps.apple.com/kw/app/mascores/id6819263516";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.almailgroup.mascores";
const HANDLE = "@mascoreslive";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
function PlayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3.6 1.8 13.4 12l-9.8 10.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Zm11 11.4 2.5 2.6-11.2 6.4 8.7-9Zm3.8-4.5 3 1.7c.9.5.9 1.8 0 2.3l-3 1.7-2.8-2.9 2.8-2.8ZM5.9 1.8l11.2 6.4-2.5 2.6-8.7-9Z" />
    </svg>
  );
}
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

// Formation positions on the pitch (percent of board width/height).
const SPOTS: Record<string, { x: number; y: number; n: string }> = {
  app: { x: 28, y: 22, n: "9" },
  play: { x: 72, y: 22, n: "10" },
  web: { x: 50, y: 44, n: "8" },
  ig: { x: 22, y: 64, n: "7" },
  x: { x: 78, y: 64, n: "11" },
  mail: { x: 50, y: 84, n: "1" },
};
// Passing move drawn on the board, in order.
const PASSES: [string, string][] = [["mail", "web"], ["web", "ig"], ["ig", "app"], ["web", "x"], ["x", "play"], ["app", "play"]];

const COPY = {
  en: {
    tag: "Kuwaiti football, live",
    board: "Pick your position",
    hint: "Tap a player to open",
    links: [
      { key: "app", title: "App Store", desc: "iPhone", href: APP_STORE },
      { key: "play", title: "Google Play", desc: "Android", href: GOOGLE_PLAY },
      { key: "web", title: "Website", desc: "mascores.live", href: "https://mascores.live" },
      { key: "ig", title: "Instagram", desc: HANDLE, href: "https://instagram.com/mascoreslive" },
      { key: "x", title: "X", desc: HANDLE, href: "https://x.com/mascoreslive" },
      { key: "mail", title: "Contact", desc: "info@mascores.live", href: "mailto:info@mascores.live" },
    ],
    by: "Made by Mansour Almail",
    toggle: "العربية",
  },
  ar: {
    tag: "الكرة الكويتية مباشرة",
    board: "اختر مركزك",
    hint: "اضغط على لاعب للفتح",
    links: [
      { key: "app", title: "متجر آبل", desc: "آيفون", href: APP_STORE },
      { key: "play", title: "جوجل بلاي", desc: "أندرويد", href: GOOGLE_PLAY },
      { key: "web", title: "الموقع", desc: "mascores.live", href: "https://mascores.live" },
      { key: "ig", title: "إنستغرام", desc: HANDLE, href: "https://instagram.com/mascoreslive" },
      { key: "x", title: "إكس", desc: HANDLE, href: "https://x.com/mascoreslive" },
      { key: "mail", title: "تواصل", desc: "info@mascores.live", href: "mailto:info@mascores.live" },
    ],
    by: "من صنع منصور المعيل",
    toggle: "English",
  },
} as const;

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "MaScores — Links | Kuwaiti football live" },
      { name: "description", content: "All MaScores links: iPhone app on the App Store, Android app on Google Play, website, Instagram and X (@mascoreslive), and contact." },
      { property: "og:title", content: "MaScores — Links" },
      { property: "og:description", content: "App Store, Google Play, website, Instagram and X for MaScores, Kuwaiti football live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinksPage,
});

function LinkIcon({ k }: { k: string }) {
  if (k === "app") return <AppleLogo className="h-5 w-5" />;
  if (k === "play") return <PlayLogo className="h-5 w-5" />;
  if (k === "web") return <Globe className="h-5 w-5" />;
  if (k === "ig") return <Instagram className="h-5 w-5" />;
  if (k === "x") return <XLogo className="h-4 w-4" />;
  return <Mail className="h-5 w-5" />;
}

function LinksPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const c = COPY[lang];
  const rtl = lang === "ar";

  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} className="links-page overflow-hidden bg-background text-foreground">
      <main className="tb-stage mx-auto max-w-md px-5">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <BrandLogo showWordmark={false} className="h-8 w-8 object-contain" />
            <div><div className="text-base font-black leading-none">MaScores</div><div className="text-[11px] font-bold text-muted-foreground">{c.tag}</div></div>
          </div>
          <Button variant="ghost" onClick={() => setLang(rtl ? "en" : "ar")} className="gap-2 text-xs font-bold"><Languages className="h-4 w-4" />{c.toggle}</Button>
        </div>

        <div className="flex items-baseline justify-between px-1 pb-2">
          <h1 className="text-xl font-black">{c.board}</h1>
          <span className="text-[11px] font-bold text-muted-foreground">{c.hint}</span>
        </div>

        {/* The board itself stays left-to-right so the formation never mirrors. */}
        <div className="tb-board" dir="ltr">
          <svg className="tb-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <rect x="3" y="3" width="94" height="94" rx="2" />
            <line x1="3" y1="50" x2="97" y2="50" />
            <circle cx="50" cy="50" r="11" />
            <rect x="28" y="3" width="44" height="14" />
            <rect x="28" y="83" width="44" height="14" />
            <rect x="40" y="3" width="20" height="5" />
            <rect x="40" y="92" width="20" height="5" />
          </svg>
          <svg className="tb-passes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <marker id="tb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10z" /></marker>
            </defs>
            {PASSES.map(([a, b], i) => {
              const p = SPOTS[a], q = SPOTS[b];
              const mx = (p.x + q.x) / 2 + (q.y - p.y) * 0.18, my = (p.y + q.y) / 2 - (q.x - p.x) * 0.18;
              return <path key={i} d={`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`} markerEnd="url(#tb-arrow)" pathLength={1} style={{ animationDelay: `${0.5 + i * 0.35}s` }} />;
            })}
          </svg>
          <div className="tb-ball" aria-hidden />
          <nav aria-label={c.board} dir={rtl ? "rtl" : "ltr"}>
            {c.links.map((l, i) => {
              const s = SPOTS[l.key];
              return (
                <a key={l.key} href={l.href} target={l.key === "mail" ? undefined : "_blank"} rel="noreferrer"
                  className={`tb-player tb-${l.key}`} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${0.1 + i * 0.08}s` }}>
                  <span className="tb-token"><LinkIcon k={l.key} /><i>{s.n}</i></span>
                  <span className="tb-name">{l.title}</span>
                  <span className="tb-desc"><bdi>{l.desc}</bdi></span>
                </a>
              );
            })}
          </nav>
        </div>

        <div className="flex gap-2 py-3">
          <a href={APP_STORE} target="_blank" rel="noreferrer" className="tb-store"><AppleLogo className="h-5 w-5" /><span>App Store</span></a>
          <a href={GOOGLE_PLAY} target="_blank" rel="noreferrer" className="tb-store"><PlayLogo className="h-5 w-5" /><span>Google Play</span></a>
        </div>
        <p className="pb-3 text-center text-[10px] font-bold text-muted-foreground">{c.by}</p>
      </main>
    </div>
  );
}
