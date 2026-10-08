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
  // Present as mobile Safari so Google allows its sign-in page inside the app.
  overrideUserAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  server: {
    url: appUrl,
    cleartext: false,
    // Our own hosts plus the sign-in hosts, so Google/Apple sign-in stays
    // inside the app and returns the session to it instead of Safari.
    allowNavigation: [
      ...ownHosts,
      "oauth.lovable.app",
      "*.lovable.app",
      "accounts.google.com",
      "*.google.com",
      "*.gstatic.com",
      "appleid.apple.com",
      "*.apple.com",
      "*.supabase.co",
    ],
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
