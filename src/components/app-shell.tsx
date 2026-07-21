import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Search, Trophy, Newspaper, Star, User, LogIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: "/" | "/search" | "/competitions" | "/news" | "/favorites" | "/profile"; label: string; icon: typeof Home; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/competitions", label: "Competitions", icon: Trophy },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/favorites", label: "Favorites", icon: Star },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAvatarUrl(null);
      setDisplayName(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setDisplayName(data.display_name ?? null);
      if (data.avatar_url) {
        if (data.avatar_url.startsWith("http")) {
          setAvatarUrl(data.avatar_url);
        } else {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          if (!cancelled) setAvatarUrl(signed?.signedUrl ?? null);
        }
      } else {
        setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const initial = (displayName || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background:radial-gradient(circle_at_10%_-10%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_100%_100%,color-mix(in_oklab,var(--primary)_15%,transparent),transparent_60%)]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex shrink-0">
            <BrandLogo variant="horizontal" className="h-8 w-auto rounded-md sm:h-9" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!loading && (
              user ? (
                <Link
                  to="/profile"
                  aria-label="Your profile"
                  className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-sm font-semibold text-foreground shadow-sm transition hover:ring-2 hover:ring-primary/50"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{initial}</span>
                  )}
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow"
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-2 py-2">
          {NAV.map((item) => {
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
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
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