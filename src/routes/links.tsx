import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Globe, Mail, ArrowUpRight, Instagram, Languages, RotateCw } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-mark-v2.png.asset.json";

const APP_STORE = "https://apps.apple.com/kw/app/mascores/id6819263516";
const HANDLE = "@mascoreslive";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
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

const COPY = {
  en: {
    name: "MaScores",
    tag: "Kuwaiti football, live",
    rating: "OVR",
    edition: "Edition 2026/27",
    serial: "No. 001",
    stats: [["99", "LIVE"], ["98", "TABLES"], ["97", "LINEUPS"], ["99", "ALERTS"], ["96", "NEWS"], ["98", "STATS"]],
    hint: "Tap the card to flip",
    backTitle: "Find us",
    flip: "Flip card",
    flipBack: "Show front",
    links: [
      { key: "app", title: "App Store", desc: "MaScores for iPhone", href: APP_STORE },
      { key: "web", title: "Website", desc: "mascores.live", href: "https://mascores.live" },
      { key: "ig", title: "Instagram", desc: HANDLE, href: "https://instagram.com/mascoreslive" },
      { key: "x", title: "X", desc: HANDLE, href: "https://x.com/mascoreslive" },
      { key: "mail", title: "Contact us", desc: "info@mascores.live", href: "mailto:info@mascores.live" },
    ],
    by: "Made by Mansour Almail",
    toggle: "العربية",
  },
  ar: {
    name: "ما سكورز",
    tag: "الكرة الكويتية مباشرة",
    rating: "تقييم",
    edition: "إصدار ٢٠٢٦/٢٧",
    serial: "رقم ٠٠١",
    stats: [["٩٩", "مباشر"], ["٩٨", "الترتيب"], ["٩٧", "التشكيلات"], ["٩٩", "التنبيهات"], ["٩٦", "الأخبار"], ["٩٨", "الإحصاءات"]],
    hint: "اضغط على البطاقة لقلبها",
    backTitle: "تجدنا هنا",
    flip: "اقلب البطاقة",
    flipBack: "الوجه الأمامي",
    links: [
      { key: "app", title: "متجر آبل", desc: "ما سكورز للآيفون", href: APP_STORE },
      { key: "web", title: "الموقع", desc: "mascores.live", href: "https://mascores.live" },
      { key: "ig", title: "إنستغرام", desc: HANDLE, href: "https://instagram.com/mascoreslive" },
      { key: "x", title: "إكس", desc: HANDLE, href: "https://x.com/mascoreslive" },
      { key: "mail", title: "تواصل معنا", desc: "info@mascores.live", href: "mailto:info@mascores.live" },
    ],
    by: "من صنع منصور المعيل",
    toggle: "English",
  },
} as const;

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "MaScores — Links | Kuwaiti football live" },
      { name: "description", content: "All MaScores links: website, iPhone app on the App Store, Instagram and X (@mascoreslive), and contact. Kuwaiti football scores, standings and lineups." },
      { property: "og:title", content: "MaScores — Links" },
      { property: "og:description", content: "Website, iPhone app, Instagram and X for MaScores, Kuwaiti football live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinksPage,
});

function LinkIcon({ k }: { k: string }) {
  if (k === "app") return <AppleLogo className="h-5 w-5" />;
  if (k === "web") return <Globe className="h-5 w-5" />;
  if (k === "ig") return <Instagram className="h-5 w-5" />;
  if (k === "x") return <XLogo className="h-4 w-4" />;
  return <Mail className="h-5 w-5" />;
}

function LinksPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [flipped, setFlipped] = useState(false);
  const [tracking, setTracking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const c = COPY[lang];
  const rtl = lang === "ar";

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--rx", `${(0.5 - y) * 22}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 26 * (flipped ? -1 : 1)}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    if (!tracking) setTracking(true);
  };
  const onLeave = () => {
    const el = cardRef.current;
    if (el) ["--rx", "--ry", "--mx", "--my"].forEach((v) => el.style.removeProperty(v));
    setTracking(false);
  };
  const onCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    setFlipped((f) => !f);
  };

  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} className="links-page min-h-screen overflow-hidden bg-background text-foreground">
      <main className="tc-stage mx-auto max-w-md px-5 pb-10">
        <div className="flex items-center justify-between py-4">
          <BrandLogo showWordmark={false} className="h-7 w-7 object-contain" />
          <Button variant="ghost" onClick={() => setLang(rtl ? "en" : "ar")} className="gap-2 text-xs font-bold"><Languages className="h-4 w-4" />{c.toggle}</Button>
        </div>

        <div className="tc-deal mt-4">
          <div
            ref={cardRef}
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            aria-label={flipped ? c.flipBack : c.flip}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            onPointerCancel={onLeave}
            onClick={onCardClick}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setFlipped((f) => !f); } }}
            className={`tc-tilt ${flipped ? "is-flipped" : ""} ${tracking ? "is-tracking" : "is-idle"}`}
          >
            <div className={`tc-card ${flipped ? "is-flipped" : ""}`}>
            <section className="tc-face tc-front" inert={flipped} aria-hidden={flipped}>
              <div className="tc-art"><div className="tc-rays" /></div>
              <img src={logo.url} alt={c.name} className="tc-logo" />
              <div className="tc-rating"><b>99</b><span>{c.rating}</span></div>
              <div className="tc-edition"><div>{c.edition}</div><div>{c.serial}</div></div>
              <div className="tc-plate">
                <h1>{c.name}</h1>
                <p>{c.tag}</p>
                <div className="tc-rule" />
                <div className="tc-stats">
                  {c.stats.map(([v, l], i) => <div key={l} style={{ animationDelay: `${0.9 + i * 0.08}s` }}><b>{v}</b><span>{l}</span></div>)}
                </div>
              </div>
              <div className="tc-hint"><i><RotateCw className="inline h-3 w-3" /></i> {c.hint}</div>
              <div className="tc-frame" />
              <div className="tc-sparkle" />
              <div className="tc-foil" />
              <div className="tc-glare" />
            </section>

            <section className="tc-face tc-back" inert={!flipped} aria-hidden={!flipped}>
              <div className="tc-back-inner">
                <div className="tc-back-head">
                  <div><h2 className="text-2xl font-black">{c.backTitle}</h2><span className="text-xs font-bold text-primary" dir="ltr">{HANDLE}</span></div>
                  <img src={logo.url} alt="" className="h-11 w-11 object-contain" />
                </div>
                <div className="tc-rule" style={{ width: "100%" }} />
                <nav className="flex flex-1 flex-col justify-center" aria-label={c.backTitle}>
                  {c.links.map((l, i) => (
                    <a key={l.key} href={l.href} target={l.key === "mail" ? undefined : "_blank"} rel="noreferrer" className={`tc-link tc-link-${l.key}`} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
                      <span className="tc-link-icon"><LinkIcon k={l.key} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-base font-black">{l.title}</span><span className="block truncate text-xs text-muted-foreground"><bdi>{l.desc}</bdi></span></span>
                      <ArrowUpRight className={`h-4 w-4 shrink-0 text-muted-foreground ${rtl ? "-scale-x-100" : ""}`} />
                    </a>
                  ))}
                </nav>
                <p className="text-center text-[10px] font-bold text-muted-foreground">{c.by}</p>
              </div>
              <div className="tc-frame" />
              <div className="tc-foil" />
              <div className="tc-glare" />
            </section>
            </div>
          </div>
        </div>
        <div className="tc-shadow" aria-hidden />

        <div className="tc-actions mt-6 flex flex-col items-center gap-3">
          <Button onClick={() => setFlipped((f) => !f)} variant="outline" className="gap-2 rounded-full px-6 font-bold">
            <RotateCw className="h-4 w-4" />{flipped ? c.flipBack : c.flip}
          </Button>
          <a href={APP_STORE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background">
            <AppleLogo className="h-4 w-4" />{c.links[0].title}
          </a>
        </div>
      </main>
    </div>
  );
}
