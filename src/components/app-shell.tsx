import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Home, Search, Trophy, Newspaper, ArrowLeftRight, Ticket, Settings, LogIn, ArrowLeft, MoreHorizontal, Radio, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { BrandLogo } from "@/components/brand-logo";
import { LiveVoiceAlert } from "@/components/live-voice-alert";
import { useReminderAlerts } from "@/components/match-reminders";

type NavItem = { to: "/" | "/search" | "/competitions" | "/news" | "/transfers" | "/tickets" | "/voice" | "/settings"; labelKey: string; icon: typeof Home; exact?: boolean };
/** Shown in the mobile tab bar. */
const PRIMARY_NAV: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/search", labelKey: "nav.search", icon: Search },
  { to: "/competitions", labelKey: "nav.competitions", icon: Trophy },
  { to: "/news", labelKey: "nav.news", icon: Newspaper },
];
/** Reached from the "More" sheet on mobile, always visible on desktop. */
const SECONDARY_NAV: NavItem[] = [
  { to: "/voice", labelKey: "nav.voice", icon: Radio },
  { to: "/transfers", labelKey: "nav.transfers", icon: ArrowLeftRight },
  { to: "/tickets", labelKey: "nav.tickets", icon: Ticket },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];
const NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { void user; }, [user]);
  useReminderAlerts();

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["shell-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const initials = (profile.data?.display_name ?? user?.email ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background:radial-gradient(circle_at_10%_-10%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_100%_100%,color-mix(in_oklab,var(--primary)_15%,transparent),transparent_60%)]" />

      {!bare && <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex shrink-0 items-center gap-2">
            <BrandLogo className="h-10" />
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-[0.82rem] font-medium transition ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && (
              user ? (
                <Link
                  to="/settings"
                  aria-label={t("nav.settings")}
                  className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-sm font-bold text-foreground shadow-sm transition hover:ring-2 hover:ring-primary/50"
                >
                  {profile.data?.avatar_url
                    ? <img src={profile.data.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <span>{initials}</span>}
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow"
                >
                  <LogIn className="h-4 w-4" /> {t("nav.signIn")}
                </Link>
              )
            )}
          </div>
        </div>
      </header>}

      {!bare && <LiveVoiceAlert />}

      {/* Extra bottom room so the iPhone home bar never covers page actions. */}
      <main
        className="relative z-10 mx-auto max-w-7xl px-4 pt-6 sm:px-6"
        style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
      >{children}</main>

      {!bare && <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-around px-2 py-2">
          {PRIMARY_NAV.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-medium ${
              SECONDARY_NAV.some((item) => location.pathname.startsWith(item.to)) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            {t("nav.more")}
          </button>
        </div>
      </nav>}

      {!bare && moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-3xl border-t border-border bg-background p-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">{t("nav.more")}</h2>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-semibold ${
                    location.pathname.startsWith(item.to) ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
                  }`}
                >
                  <item.icon className="h-4 w-4" /> {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
      {action}
    </div>
  );
}

/** Back control for detail pages — steps through history, falling back to the home page. */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { lang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => { if (router.history.canGoBack()) router.history.back(); else router.navigate({ to: "/" }); }}
      className={`mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground ${className}`}
    >
      <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "رجوع" : "Back"}
    </button>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}

export function LoadingSkeleton({ count = 4, className = "h-24" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${className} animate-pulse rounded-2xl border border-border bg-card/50`} />
      ))}
    </div>
  );
}

/**
 * Wraps a horizontally scrollable tab row with a quiet hint that there is more
 * to the side: soft edge fades and a small arrow, no animation or nagging pill.
 */
export function SwipeTabs({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { lang } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ start: false, end: false });
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let idle = 0;
    const update = () => {
      const max = node.scrollWidth - node.clientWidth;
      const pos = Math.abs(node.scrollLeft);
      setEdge({ start: max > 8 && pos > 8, end: max > 8 && pos < max - 8 });
    };
    // Once the user swipes at all, the hint is done for good.
    const onScroll = () => {
      update();
      setMoved(true);
    };
    update();
    const timer = window.setTimeout(update, 400);
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.clearTimeout(timer); window.clearTimeout(idle); node.removeEventListener("scroll", onScroll); window.removeEventListener("resize", update); };
  }, [children]);

  // Tapping an arrow slides most of a screenful, so one tap reveals the rest.
  const nudge = (dir: 1 | -1) => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: dir * Math.max(160, node.clientWidth * 0.8) * (lang === "ar" ? -1 : 1), behavior: "smooth" });
  };
  const arrowCls = "absolute top-1/2 z-10 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-current/10 text-current transition-opacity duration-300";
  // The arrow is only a first-time hint: once the row has been moved at all it stays away.
  const hint = edge.end && !moved;

  return (
    <div className="relative">
      <div ref={ref} className={`flex max-w-full snap-x scroll-px-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      {/* Only a forward hint: it exists to say "there are more tabs", never to go back. */}
      <button
        type="button" aria-label="More tabs" tabIndex={hint ? 0 : -1} onClick={() => nudge(1)}
        className={`${arrowCls} end-0 ${hint ? "opacity-70" : "pointer-events-none opacity-0"}`}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </button>
    </div>
  );
}


