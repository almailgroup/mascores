import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Database, Eye, Lock, Mail, UserX, FileText, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacypolicy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MansourAlmailScores" },
      {
        name: "description",
        content:
          "How MansourAlmailScores collects, uses, and protects your information. Read our full privacy policy.",
      },
      { property: "og:title", content: "Privacy Policy — MansourAlmailScores" },
      {
        property: "og:description",
        content:
          "How MansourAlmailScores collects, uses, and protects your information. Read our full privacy policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);

  const sections = [
    {
      icon: Eye,
      title: t("What we collect", "ما نجمعه"),
      body: t(
        "When you create an account we store your email address and the name you choose to show. If you post in match chat, write feedback, sell a ticket, or appear in a leaderboard, that content and your display name are stored so the feature works. Voice messages you record in voice rooms are stored until you or a moderator remove them.",
        "عند إنشاء حساب نخزّن بريدك الإلكتروني والاسم الذي تختاره للعرض. إذا كتبت في دردشة المباراة أو أرسلت ملاحظات أو عرضت تذكرة أو ظهرت في لوحة صدارة، فنخزّن ذلك المحتوى واسمك حتى تعمل الميزة. الرسائل الصوتية التي تسجلها في الغرف الصوتية تُخزَّن حتى تحذفها أنت أو أحد المشرفين.",
      ),
    },
    {
      icon: Database,
      title: t("How we use it", "كيف نستخدمه"),
      body: t(
        "We use your information only to run the app: showing live scores, keeping your favorites and reminders, delivering the notifications you asked for, processing tickets, and keeping the community safe from spam and abuse. We do not sell your data, and we do not use it to build advertising profiles.",
        "نستخدم معلوماتك فقط لتشغيل التطبيق: عرض النتائج المباشرة، حفظ المفضلة والتنبيهات، إرسال الإشعارات التي طلبتها، معالجة التذاكر، وحماية المجتمع من الإساءة. لا نبيع بياناتك ولا نستخدمها لملفات إعلانية.",
      ),
    },
    {
      icon: Lock,
      title: t("How it is protected", "كيف نحميها"),
      body: t(
        "Your account is secured with a password you choose, and sign-in happens over an encrypted connection. Access to personal data is limited to the site owner and the people they explicitly authorize. Payment details are never stored on our servers.",
        "حسابك محمي بكلمة مرور تختارها، ويتم تسجيل الدخول عبر اتصال مشفّر. الوصول إلى البيانات الشخصية محصور بمالك الموقع ومن يخوّلهم صراحةً. لا نخزّن بيانات الدفع على خوادمنا إطلاقاً.",
      ),
    },
    {
      icon: UserX,
      title: t("What we don't do", "ما لا نفعله"),
      body: t(
        "We don't track you across other websites, we don't require your real name, and we don't share your personal details with other supporters. If you sell a ticket, your contact details are shown only to the person buying that ticket, and only for that sale.",
        "لا نتتبعك في مواقع أخرى، ولا نطلب اسمك الحقيقي، ولا نشارك بياناتك مع المشجعين الآخرين. إذا عرضت تذكرة للبيع، تظهر بيانات تواصلك فقط لمشتري تلك التذكرة وذلك للبيع فقط.",
      ),
    },
    {
      icon: RefreshCcw,
      title: t("Your choices", "خياراتك"),
      body: t(
        "You can change your display name and notification preferences any time in Settings, and you can sign out from any device. When you want your account removed, write to us using the details on the support page and we will delete it.",
        "يمكنك تغيير اسمك وإعدادات الإشعارات في أي وقت من الإعدادات، وتسجيل الخروج من أي جهاز. وعندما ترغب بحذف حسابك، راسلنا عبر بيانات صفحة الدعم وسنحذفه.",
      ),
    },
    {
      icon: FileText,
      title: t("Changes to this policy", "تغييرات هذه السياسة"),
      body: t(
        "If we change how we handle your information, we will update this page. The date below always reflects the current version.",
        "إذا غيّرنا طريقة تعاملنا مع معلوماتك، سنحدّث هذه الصفحة. التاريخ أدناه يعكس دائماً النسخة الحالية.",
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
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("Privacy Policy", "سياسة الخصوصية")}
            </div>
            <div className="mt-5 flex items-center gap-4">
              <BrandLogo className="h-12 sm:h-14" />
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t(
                "Your trust matters more than anything we build. This page explains, in plain language, what information MansourAlmailScores keeps and why.",
                "ثقتك أهم من أي شيء نبنيه. توضح هذه الصفحة بلغة بسيطة ما المعلومات التي يحتفظ بها MansourAlmailScores ولماذا.",
              )}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("Last updated", "آخر تحديث")}: October 2026
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} className="rounded-3xl border border-border bg-card p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-bold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>

        {/* Contact */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-bold tracking-tight">
            {t("Questions about your privacy?", "أسئلة حول خصوصيتك؟")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Write to the site owner directly — every message is read.",
              "راسل مالك الموقع مباشرة — كل رسالة تُقرأ.",
            )}
          </p>
          <a
            href="mailto:mansouralmailscores@gmail.com"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> mansouralmailscores@gmail.com
          </a>
        </section>
      </div>
    </AppShell>
  );
}
