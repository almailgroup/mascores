import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Instagram, MessageCircle, Bug, Trophy, ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — MansourAlmailScores" },
      {
        name: "description",
        content:
          "Get in touch with the MansourAlmailScores team — email and Instagram support for scores, tickets, and accounts.",
      },
      { property: "og:title", content: "Support — MansourAlmailScores" },
      {
        property: "og:description",
        content:
          "Get in touch with the MansourAlmailScores team — email and Instagram support for scores, tickets, and accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);

  const topics = [
    {
      icon: Bug,
      title: t("Something broken?", "هل هناك خلل؟"),
      body: t(
        "Found a wrong score, a missing photo, or a page that won't load? Send us a screenshot and we'll sort it out.",
        "وجدت نتيجة خاطئة أو صورة ناقصة أو صفحة لا تفتح؟ أرسل لنا لقطة شاشة وسنحل الأمر.",
      ),
    },
    {
      icon: Trophy,
      title: t("Tickets & matches", "التذاكر والمباريات"),
      body: t(
        "Questions about buying a ticket, a transfer, or entry at the gate? Include your ticket number if you have one.",
        "سؤال عن شراء تذكرة أو تحويلها أو الدخول من البوابة؟ أرفق رقم تذكرتك إن وُجد.",
      ),
    },
    {
      icon: ArrowLeftRight,
      title: t("Your account", "حسابك"),
      body: t(
        "Need a name change or want your account removed? Just ask — we handle it directly.",
        "تريد تغيير اسمك أو حذف حسابك؟ اطلب ذلك وسننهيه مباشرة.",
      ),
    },
    {
      icon: MessageCircle,
      title: t("Ideas & feedback", "الأفكار والملاحظات"),
      body: t(
        "This app is built around what supporters ask for. Tell us what you'd like next.",
        "هذا التطبيق مبني على طلبات المشجعين. أخبرنا بما تريد بعد ذلك.",
      ),
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-16">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_0%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_50%),radial-gradient(circle_at_100%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_55%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[0.7rem] font-black uppercase tracking-widest text-primary">
              <MessageCircle className="h-3.5 w-3.5" />
              {t("Support", "الدعم")}
            </div>
            <div className="mt-5">
              <BrandLogo className="h-12 sm:h-14" />
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
              {t("We're here for you", "نحن هنا من أجلك")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t(
                "One team, real people. Reach out on either channel below and you'll hear back from us.",
                "فريق واحد وأشخاص حقيقيون. تواصل معنا عبر أي من القناتين أدناه وسنرد عليك.",
              )}
            </p>
          </div>
        </div>

        {/* Channels */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:mansouralmailscores@gmail.com"
            className="group rounded-3xl border border-border bg-card p-6 transition hover:border-primary/50 hover:ring-2 hover:ring-primary/20"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-bold tracking-tight">{t("Email us", "راسلنا بالبريد")}</h2>
            <p className="mt-1 break-all text-sm font-semibold text-primary">mansouralmailscores@gmail.com</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(
                "Best for account issues, tickets, and anything with an attachment.",
                "الأفضل لقضايا الحساب والتذاكر وكل ما يحتاج مرفقات.",
              )}
            </p>
          </a>

          <a
            href="https://instagram.com/mascoreslive"
            target="_blank"
            rel="noreferrer"
            className="group rounded-3xl border border-border bg-card p-6 transition hover:border-primary/50 hover:ring-2 hover:ring-primary/20"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Instagram className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-bold tracking-tight">{t("Instagram", "إنستغرام")}</h2>
            <p className="mt-1 text-sm font-semibold text-primary">@mascoreslive</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(
                "Message us there for quick questions — and follow for live updates.",
                "راسلنا هناك للأسئلة السريعة — وتابعنا لآخر المستجدات.",
              )}
            </p>
          </a>
        </div>

        {/* Topics */}
        <h2 className="mb-3 mt-8 text-lg font-bold tracking-tight">
          {t("What can we help with?", "كيف يمكننا مساعدتك؟")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {topics.map(({ icon: Icon, title, body }) => (
            <section key={title} className="rounded-3xl border border-border bg-card p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>

        {/* Privacy link */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-base font-bold tracking-tight">{t("Your privacy", "خصوصيتك")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Want to know what we keep and why? Read our",
              "تريد معرفة ما نحتفظ به ولماذا؟ اقرأ",
            )}{" "}
            <Link to="/privacypolicy" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t("privacy policy", "سياسة الخصوصية")}.
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
