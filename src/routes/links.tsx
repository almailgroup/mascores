import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Mail, ArrowUpRight, Instagram, Languages } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

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
    tag: "الكرة الكويتية مباشرة",
    sub: "النتائج · الترتيب · التشكيلات · الأخبار",
    appStore: {
      kicker: "حمّل التطبيق من",
      title: "آب ستور",
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
  const [logoReplay, setLogoReplay] = useState(0);
  const c = COPY[lang];
  const rtl = lang === "ar";
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="links-page relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* A drawn centre circle gives the page its football identity. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]">
        <div className="links-field absolute left-1/2 top-40 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full border-[3px] border-[var(--links-pitch)]" />
        <div className="absolute inset-x-0 top-[22.5rem] h-[3px] bg-[var(--links-pitch)]" />
        <div className="absolute left-1/2 top-[22.15rem] h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--links-pitch)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="links-language h-10 gap-2 rounded-full border-border bg-card px-4 text-sm font-bold shadow-sm">
            <Languages className="h-4 w-4 text-primary" />{c.toggle}
          </Button>
        </div>

        <header className={`mt-7 flex flex-col items-center text-center transition-all duration-700 links-rise`}>
          <div key={logoReplay} className="links-emblem relative grid h-36 w-36 place-items-center">
            <span aria-hidden className="links-orbit"><span className="links-orbit-ball">⚽</span></span>
            <span aria-hidden className="links-emblem-ring" />
            <Button variant="ghost" aria-label="MaScores" onClick={() => setLogoReplay(value => value + 1)} className="links-logo h-28 w-28 rounded-[2rem] border border-border bg-card p-0">
              <BrandLogo showWordmark={false} className="h-20 w-20 object-contain" />
            </Button>
          </div>
          <h1 className="links-wordmark mt-3 text-4xl font-black" aria-label="MaScores" dir="ltr">
            {"MaScores".split("").map((letter, i) => <span key={i} aria-hidden>{letter}</span>)}
          </h1>
          <p className="mt-2 text-lg font-bold text-primary">{c.tag}</p>
          <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
        </header>

        {/* Halfway-line divider with the match ball. */}
        <div aria-hidden className="links-kickoff mt-9 flex items-center gap-3 links-rise" style={{ animationDelay: "80ms" }}>
          <span className="h-px flex-1 bg-border" />
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-border bg-card">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Featured: App Store. */}
        <a href={APP_STORE} target="_blank" rel="noreferrer"
          style={{ animationDelay: "150ms" }}
          className="links-feature links-interactive links-rise group relative mt-6 block overflow-hidden rounded-[2rem] bg-primary p-5 text-primary-foreground">
          <div aria-hidden className="links-shine pointer-events-none absolute inset-0" />
          <div className="relative flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15 ring-1 ring-inset ring-primary-foreground/25 backdrop-blur-sm">
              <AppleLogo className="h-9 w-9" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.68rem] font-bold uppercase tracking-[0.2em] opacity-75">{c.appStore.kicker}</div>
              <div className="text-2xl font-black leading-tight">{c.appStore.title}</div>
              <div className="mt-0.5 text-sm opacity-85">{c.appStore.desc}</div>
            </div>
            <ArrowUpRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${rtl ? "-scale-x-100" : ""}`} />
          </div>
          <div className="relative mt-4 flex items-center justify-between border-t border-primary-foreground/20 pt-3">
            <span className="text-xs font-bold opacity-80" dir="ltr">mascores.live</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground px-3.5 py-1 text-xs font-black text-primary">
              {c.appStore.cta}
            </span>
          </div>
        </a>

        {/* Website and contact, ticket-stub cards. */}
        <nav className="mt-3 space-y-3">
          {c.items.map((item, i) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} target={item.href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer"
                style={{ animationDelay: `${260 + i * 90}ms` }}
                className={`links-ticket links-interactive group relative flex items-stretch overflow-hidden rounded-3xl border border-border bg-card links-rise`}>
                <div className={`flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-dashed ${rtl ? "border-l" : "border-r"} border-border`}>
                  <span className="text-[0.65rem] font-black tracking-widest text-muted-foreground">{item.n}</span>
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1 px-4 py-4">
                  <div className="text-lg font-black leading-tight">{item.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{item.desc}</div>
                  <div className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[0.7rem] font-bold text-primary" dir="ltr">{item.meta}</div>
                </div>
                <div className="flex items-center px-4">
                  <ArrowUpRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${rtl ? "-scale-x-100" : ""}`} />
                </div>
              </a>
            );
          })}
        </nav>

        {/* Socials. */}
        <section className="mt-8 links-rise" style={{ animationDelay: "440ms" }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">{c.socialTitle}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {c.social.map((item, i) => {
              const ig = i === 0;
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noreferrer"
                  style={{ animationDelay: `${500 + i * 90}ms` }}
                  className="links-social links-interactive group links-rise relative overflow-hidden rounded-3xl border border-border bg-card p-4 text-center">
                  <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${ig ? "links-ig" : "links-x"}`}>
                    {ig ? <Instagram className="h-6 w-6" /> : <XLogo className="h-5 w-5" />}
                  </div>
                  <div className="mt-3 text-sm font-black">{item.name}</div>
                  <div className="text-xs font-bold text-primary" dir="ltr">{HANDLE}</div>
                  <div className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{item.desc}</div>
                </a>
              );
            })}
          </div>
        </section>

        <div aria-hidden className="links-ticker mt-8 overflow-hidden border-y border-border py-3" dir="ltr">
          <div className="links-ticker-track flex w-max items-center gap-6 text-xs font-bold text-primary">
            {Array.from({ length: 4 }, (_, i) => <span key={i} className="flex items-center gap-6"><span>MaScores</span><span className="links-ticker-star">✦</span><span>{HANDLE}</span><span className="links-ticker-star">✦</span></span>)}
          </div>
        </div>
        <footer className="mt-auto pt-8 text-center text-xs font-semibold text-muted-foreground">{c.by}</footer>
      </main>
    </div>
  );
}
