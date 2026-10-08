import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The site the native shell loads.
 *
 * This app is server-rendered and calls server functions (chat, tickets, AI,
 * admin), so there is no static bundle to ship inside the app — the shell points
 * at the live site instead. `native/www` exists only because Capacitor requires
 * a webDir; it is never shown while the site is reachable.
 *
 * Set MAS_APP_URL to the production origin before `npx cap sync`.
 */
const appUrl = process.env.MAS_APP_URL;

if (!appUrl) {
  throw new Error(
    "MAS_APP_URL is not set. Point it at the production site before syncing, e.g.\n" +
      "  MAS_APP_URL=https://your-domain.com npx cap sync ios",
  );
}

const appHost = new URL(appUrl).host;

// Every host the site may redirect between (bare/www/lovable.app). If the
// shell lands on a host not listed here, iOS opens it in Safari instead.
const ownHosts = Array.from(
  new Set([
    appHost,
    "mascores.live",
    "www.mascores.live",
    "mascores.lovable.app",
    "*.mascores.live",
  ]),
);

const config: CapacitorConfig = {
  appId: "com.almailgroup.mascores",
  appName: "Mansour Almail Scores",
  webDir: "native/www",
  ios: {
    // The site paints its own dark background; avoid a white flash on push/pop.
    backgroundColor: "#0a1628",
    contentInset: "never",
    // No Safari-style link preview when pressing and holding.
    allowsLinkPreview: false,
  },
  server: {
    url: appUrl,
    cleartext: false,
    // Keep in-app navigation to our own origin; anything else opens in Safari,
    // which is also what OAuth requires — Google blocks sign-in inside webviews.
    allowNavigation: [appHost],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0a1628",
      showSpinner: false,
      launchAutoHide: true,
    },
    LocalNotifications: {
      iconColor: "#2563eb",
    },
    PushNotifications: {
      // Show goal alerts even while the app is open and in the foreground.
      presentationOptions: ["alert", "sound", "badge"],
    },
  },
};

export default config;
