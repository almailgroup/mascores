/**
 * Registers the service worker that backs offline support and home-screen installs.
 *
 * Production only — a caching service worker in dev makes rebuilds confusing, and
 * registration waits for `load` so it never competes with the initial render.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration costs offline support, not the app — stay quiet.
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
