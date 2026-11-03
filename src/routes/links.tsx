import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Apple, Mail, ArrowUpRight, Languages } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const APP_STORE = "https://apps.apple.com/kw/app/mascores/id6819263516";

const COPY = {
  en: {
    tag: "Kuwaiti football, live", sub: "Scores · Standings · Lineups · News",
    items: [
      { n: "01", title: "Website", desc: "Live scores, tables and match centres", meta: "mascores.live", href: "https://mascores.live", icon: Globe },
      { n: "02", title: "iPhone app", desc: "Goal alerts and live scores on your phone", meta: "App Store", href: APP_STORE, icon: Apple },
      { n: "03", title: "Contact us", desc: "Suggestions, corrections or partnerships", meta: "info@mascores.live", href: "mailto:info@mascores.live", icon: Mail },
    ],
    by: "Made in Kuwait by Mansour Almail", toggle: "العربية",
  },
  ar: {
    tag: "الكرة الكويتية مباشرة", sub: "النتائج · الترتيب · التشكيلات · الأخبار",
    items: [
      { n: "٠١", title: "الموقع", desc: "النتائج المباشرة والترتيب ومراكز المباريات", meta: "mascores.live", href: "https://mascores.live", icon: Globe },
      { n: "٠٢", title: "تطبيق الآيفون", desc: "تنبيهات الأهداف والنتائج على جوالك", meta: "App Store", href: APP_STORE, icon: Apple },
      { n: "٠٣", title: "تواصل معنا", desc: "اقتراح، تصحيح أو شراكة", meta: "info@mascores.live", href: "mailto:info@mascores.live", icon: Mail },
    ],
    by: "صُنع في الكويت بواسطة منصور المعيل", toggle: "English",
  },
} as const;

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "MaScores — Links | Kuwaiti football live" },
      { name: "description", content: "All MaScores links: website, iPhone app on the App Store and contact. Kuwaiti football scores, standings and lineups." },
      { property: "og:title", content: "MaScores — Links" },
      { property: "og:description", content: "Website, iPhone app and contact for MaScores, Kuwaiti football live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const c = COPY[lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="links-page relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Centre-circle and halfway line, like looking down at a pitch. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34rem]">
        <div className="absolute left-1/2 top-40 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full border-[3px] border-[var(--links-pitch)]" />
        <div className="absolute inset-x-0 top-[22.5rem] h-[3px] bg-[var(--links-pitch)]" />
        <div className="absolute left-1/2 top-[22.15rem] h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--links-pitch)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex justify-end">
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold shadow-sm active:scale-95 transition-transform">
            <Languages className="h-4 w-4 text-primary" />{c.toggle}
          </button>
        </div>

        <header className={`mt-8 flex flex-col items-center text-center transition-all duration-700 links-rise`}>
          <div className="grid h-28 w-28 place-items-center rounded-[2rem] border border-border bg-card shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--primary)_45%,transparent)] rotate-[-4deg]">
            <BrandLogo showWordmark={false} className="h-20 w-20 rotate-[4deg] object-contain" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">MaScores</h1>
          <p className="mt-2 text-lg font-bold text-primary">{c.tag}</p>
          <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
        </header>

        <nav className="mt-10 space-y-3">
          {c.items.map((item, i) => {
            const Icon = item.icon;
            const featured = i === 1;
            return (
              <a key={item.href} href={item.href} target={item.href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer"
                style={{ animationDelay: `${150 + i * 90}ms` }}
                className={`group relative flex items-stretch overflow-hidden rounded-3xl border transition-all duration-500 active:scale-[0.98] links-rise ${featured ? "border-primary bg-primary text-primary-foreground shadow-[0_20px_40px_-20px_var(--primary)]" : "border-border bg-card"}`}>
                <div className={`flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-dashed ${lang === "ar" ? "border-l" : "border-r"} ${featured ? "border-primary-foreground/30" : "border-border"}`}>
                  <span className={`text-[0.65rem] font-black tracking-widest ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.n}</span>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 px-4 py-4">
                  <div className="text-lg font-black leading-tight">{item.title}</div>
                  <div className={`mt-0.5 text-sm ${featured ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{item.desc}</div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${featured ? "bg-primary-foreground/15" : "bg-muted text-primary"}`} dir="ltr">{item.meta}</div>
                </div>
                <div className="flex items-center px-4">
                  <ArrowUpRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${lang === "ar" ? "-scale-x-100" : ""}`} />
                </div>
              </a>
            );
          })}
        </nav>

        <footer className="mt-auto pt-12 text-center text-xs font-semibold text-muted-foreground">{c.by}</footer>
      </main>
    </div>
  );
}
