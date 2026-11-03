import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Mail, ArrowUpRight, Instagram, Languages } from "lucide-react";
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
    platform: "For iPhone",
    tag: "Kuwaiti football, live",
    sub: "Scores · Standings · Lineups · News",
    appStore: {
      kicker: "Download on the",
      title: "App Store",
      desc: "Goal alerts and live scores on your iPhone",
      cta: "Get the app",
    },
    items: [
      { n: "01", title: "Website", desc: "Live scores, tables and match centres", meta: "mascores.live", href: "https://mascores.live", icon: Globe },
      { n: "02", title: "Contact us", desc: "Suggestions, corrections or partnerships", meta: "info@mascores.live", href: "mailto:info@mascores.live", icon: Mail },
    ],
    socialTitle: "Follow us",
    social: [
      { name: "Instagram", desc: "Highlights and match graphics", href: "https://instagram.com/mascoreslive" },
      { name: "X", desc: "Live updates on matchdays", href: "https://x.com/mascoreslive" },
    ],
    by: "Made in Kuwait by Mansour Almail",
    toggle: "العربية",
  },
  ar: {
    name: "ما سكورز",
    platform: "للآيفون",
    tag: "الكرة الكويتية مباشرة",
    sub: "النتائج · الترتيب · التشكيلات · الأخبار",
    appStore: {
      kicker: "حمّل التطبيق من",
      title: "متجر آبل",
      desc: "تنبيهات الأهداف والنتائج المباشرة على آيفونك",
      cta: "احصل على التطبيق",
    },
    items: [
      { n: "٠١", title: "الموقع", desc: "النتائج المباشرة والترتيب ومراكز المباريات", meta: "mascores.live", href: "https://mascores.live", icon: Globe },
      { n: "٠٢", title: "تواصل معنا", desc: "اقتراح، تصحيح أو شراكة", meta: "info@mascores.live", href: "mailto:info@mascores.live", icon: Mail },
    ],
    socialTitle: "تابعنا",
    social: [
      { name: "إنستغرام", desc: "أبرز اللقطات وبطاقات المباريات", href: "https://instagram.com/mascoreslive" },
      { name: "إكس", desc: "تحديثات مباشرة في يوم المباريات", href: "https://x.com/mascoreslive" },
    ],
    by: "صُنع في الكويت بواسطة منصور المعيل",
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

function LinksPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const c = COPY[lang];
  const rtl = lang === "ar";
  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} className="links-page min-h-screen bg-background text-foreground">
      <main className="links-layout mx-auto max-w-2xl px-6 pb-8">
        <div className="links-topline flex items-center justify-end py-4">
          <Button variant="ghost" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="gap-2 text-xs font-bold"><Languages className="h-4 w-4" />{c.toggle}</Button>
        </div>
        <header className="links-identity relative pt-7 pb-7">
          <img src={logo.url} alt={c.name} className="links-original-logo mb-5 h-24 w-24 object-contain" />
          <h1 className="links-name font-black">{c.name}<span>.</span></h1>
          <p className="mt-2 text-base font-bold">{c.tag}</p>
          <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
        </header>
        <a href={APP_STORE} target="_blank" rel="noreferrer" className="links-app links-destination group relative block overflow-hidden p-6 text-primary-foreground">
          <div aria-hidden className="links-app-stripes" />
          <div className="relative flex items-start justify-between gap-4">
            <AppleLogo className="h-8 w-8 shrink-0" />
            <span className="text-xs font-bold">{c.platform}</span>
          </div>
          <div className="relative mt-5 flex items-end justify-between gap-3">
            <div><span className="text-xs opacity-80">{c.appStore.kicker}</span><h2 className="text-3xl font-black">{c.appStore.title}</h2></div>
            <ArrowUpRight className="links-arrow h-8 w-8 shrink-0" />
          </div>
          <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-primary-foreground/25 pt-3">
            <span className="max-w-[65%] text-xs opacity-80">{c.appStore.desc}</span>
            <span className="text-xs font-bold">{c.appStore.cta}</span>
          </div>
        </a>
        <nav className="links-destinations mt-6" aria-label={rtl ? "الروابط" : "Links"}>
          {c.items.map((item, i) => {
            const Icon = item.icon;
            return <a key={item.href} href={item.href} target={i === 0 ? "_blank" : undefined} rel="noreferrer" className="links-row links-destination group flex items-center gap-4 border-b border-border py-5">
              <span className="text-[10px] text-muted-foreground">{new Intl.NumberFormat(rtl ? "ar-KW" : "en", { minimumIntegerDigits: 2 }).format(i + 2)}</span>
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><h2 className="text-xl font-black">{item.title}</h2><span className="text-xs text-muted-foreground" dir="ltr">{item.meta}</span></div>
              <ArrowUpRight className="links-arrow h-5 w-5 shrink-0" />
            </a>;
          })}
        </nav>
        <section className="mt-8">
          <div className="flex items-center justify-between"><h2 className="text-xs font-bold text-muted-foreground">{c.socialTitle}</h2><span className="text-xs font-bold" dir="ltr">{HANDLE}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-5">
            {c.social.map((item, i) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={`links-network links-destination group border-t-2 pt-4 ${i === 0 ? "links-network-ig" : "links-network-x"}`}>
              <div className="flex items-center justify-between">{i === 0 ? <Instagram className="h-6 w-6" /> : <XLogo className="h-5 w-5" />}<ArrowUpRight className="links-arrow h-4 w-4" /></div>
              <h3 className="mt-4 text-base font-black">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </a>)}
          </div>
        </section>
        <footer className="mt-10 flex items-center gap-3 border-t border-border pt-5"><BrandLogo showWordmark={false} className="h-7 w-7 object-contain" /><p className="text-[10px] text-muted-foreground">{c.by}</p></footer>
      </main>
    </div>
  );
}
