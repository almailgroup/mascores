import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { registerServiceWorker } from "@/lib/register-sw";

const DISMISS_KEY = "mas.install.dismissed";
const DISMISS_DAYS = 30;
/** Give people a moment to look at the app before asking to install it. */
const IOS_DELAY_MS = 5000;

/** Chrome fires this so the page can defer the native install dialog. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari predates display-mode and reports installs here instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the only tell.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Offers to add the app to the home screen, and registers the service worker.
 *
 * Two paths: Chrome hands us a `beforeinstallprompt` event we can replay on tap,
 * while iOS Safari has no install API at all — there we can only explain the
 * Share → Add to Home Screen gesture.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    registerServiceWorker();

    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // Suppress Chrome's own banner; we show our own.
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) timer = setTimeout(() => setShowIosHint(true), IOS_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — it just reappears next visit */
    }
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event can only be replayed once, installed or not.
    setDeferred(null);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 md:inset-x-auto md:end-6 md:w-96"
      // Clear the mobile tab bar; on md+ that bar is hidden so only the gutter is needed.
      style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl md:max-w-none">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t("install.title")}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {showIosHint ? t("install.iosBody") : t("install.body")}
          </p>
        </div>

        {showIosHint ? (
          <Share className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
          >
            {t("install.action")}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("install.dismiss")}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
