import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../components/theme-provider";
import { onNativeNotificationTap } from "../lib/native-notify";
import { initNativePush } from "../lib/native-push";
import { I18nProvider } from "../lib/i18n";
import { CurrencyProvider } from "../lib/currency";
import { HeightUnitProvider } from "../lib/units";
import { AutoTranslateProvider, useTranslationReady } from "../lib/auto-translate";
import { BrandLogo } from "../components/brand-logo";
import { isChunkLoadError, reloadForFreshFiles } from "../lib/chunk-recovery";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const staleFiles = isChunkLoadError(error);
  useEffect(() => {
    // Old page files after an update: reload to get the new ones instead of a blank page.
    if (staleFiles && reloadForFreshFiles()) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, staleFiles]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (staleFiles) { window.location.reload(); return; }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MAS" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "MansourAlmailScores — Live Football Scores" },
      {
        name: "description",
        content:
          "Live scores, match centers, lineups, and coverage of the best leagues of the world.",
      },
      { name: "author", content: "MansourAlmailScores" },
      { name: "theme-color", content: "#0a1628" },
      { property: "og:title", content: "MansourAlmailScores — Live Football Scores" },
      {
        property: "og:description",
        content:
          "Live scores, match centers, lineups, and coverage of the best leagues of the world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MansourAlmailScores — Live Football Scores" },
      { name: "twitter:description", content: "Live scores, match centers, lineups, and coverage of the best leagues of the world." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab9f645-fd29-4918-b6f6-f8760815f669/id-preview-291137d6--552dae1c-a8e4-4697-9e43-5a409c40ae78.lovable.app-1784632724087.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eab9f645-fd29-4918-b6f6-f8760815f669/id-preview-291137d6--552dae1c-a8e4-4697-9e43-5a409c40ae78.lovable.app-1784632724087.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var R=/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i,K="mas-chunk-reload";function go(m){if(!R.test(String(m||"")))return;try{var l=+sessionStorage.getItem(K)||0;if(Date.now()-l<10000)return;sessionStorage.setItem(K,String(Date.now()))}catch(e){}location.reload()}addEventListener("error",function(e){var t=e&&e.target;if(t&&(t.tagName==="SCRIPT"||(t.tagName==="LINK"&&t.rel==="modulepreload"))){go("Importing a module script failed");return}go(e&&(e.message||(e.error&&e.error.message)))},true);addEventListener("unhandledrejection",function(e){go(e&&e.reason&&(e.reason.message||e.reason))});addEventListener("vite:preloadError",function(e){e.preventDefault&&e.preventDefault();go("Unable to preload CSS")})})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // No-op on the web; inside the iOS shell this asks for notification
    // permission and registers the device for match alerts. A tapped alert
    // carries the path to open, so a full navigation is the simplest handoff.
    void initNativePush((path) => window.location.assign(path));
    void onNativeNotificationTap((path) => window.location.assign(path));
  }, []);

  useEffect(() => {
    // After an update, an open tab may request page files that no longer
    // exist ("Importing a module script failed"). Reload once to fetch fresh ones.
    const recover = () => { reloadForFreshFiles(); };
    const onPreload = (e: Event) => {
      e.preventDefault();
      recover();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) recover();
    };
    window.addEventListener("vite:preloadError", onPreload);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("vite:preloadError", onPreload);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <CurrencyProvider>
            <HeightUnitProvider>
              <AutoTranslateProvider>
                <LanguageReadyGate><Outlet /></LanguageReadyGate>
              </AutoTranslateProvider>
            </HeightUnitProvider>
          </CurrencyProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function LanguageReadyGate({ children }: { children: ReactNode }) {
  const ready = useTranslationReady();
  return (
    <>
      <div className={ready ? "contents" : "pointer-events-none select-none opacity-0"}>{children}</div>
      {!ready && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <BrandLogo className="h-14" />
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm font-semibold">جارٍ تجهيز النسخة العربية…</p>
          </div>
        </div>
      )}
    </>
  );
}
