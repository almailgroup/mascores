# iOS app

A Capacitor shell around the existing web app, plus two native features that the
web cannot do: **push notifications** and **Live Activities**.

> **None of the native code in this directory has been compiled.** It was written
> on Linux, where no Xcode or iOS SDK exists. Expect to fix small things on the
> first build. Everything on the web side (TypeScript, the service worker, the
> bundle split) *was* verified.

## What you need

| | |
|---|---|
| A Mac with Xcode 15+ | Required — iOS apps cannot be built on Linux or Windows |
| Apple Developer Program | $99/year, required to run on a real device and to ship |

## How the app loads

This app is server-rendered and uses server functions, so there is no static
bundle to embed. The shell loads the live site instead, configured by
`MAS_APP_URL` in `capacitor.config.ts`.

```bash
MAS_APP_URL=https://your-production-domain npx cap sync ios
npx cap open ios
```

`cap sync` writes `ios/App/App/capacitor.config.json` with that URL baked in.
That file is gitignored precisely so one person's URL is never committed — so
**every developer must run `cap sync` with `MAS_APP_URL` set** before building.

## Push notifications

1. **Apple Developer portal** → Keys → create an APNs key. Download the `.p8`
   **once** — Apple will not let you download it again. Note the Key ID.
2. **Xcode** → target `App` → Signing & Capabilities → add **Push Notifications**
   and **Background Modes** (tick *Remote notifications*).
3. **Supabase secrets:**
   ```bash
   supabase secrets set \
     APNS_KEY_ID=XXXXXXXXXX \
     APNS_TEAM_ID=XXXXXXXXXX \
     APNS_BUNDLE_ID=com.almailgroup.mascores \
     APNS_HOST=api.sandbox.push.apple.com \
     APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
   ```
   Use `api.sandbox.push.apple.com` for development builds and
   `api.push.apple.com` for TestFlight and the App Store. Sending to the wrong
   host fails with `BadDeviceToken`, which is the usual first-time mistake.
4. **Apply the migration and deploy the function:**
   ```bash
   supabase db push
   supabase functions deploy send-match-alert
   ```
5. **Regenerate the database types** so `device_tokens` is known to TypeScript.
   `src/lib/native-push.ts` carries a local type describing the table; once the
   types are regenerated, that block and the `withDeviceTokens()` cast can go.

Sending is admin-only — the function verifies the caller against the existing
`public.is_admin()` RPC, so it reuses the same admin list as `/admin`.

## Live Activities

The Swift is written but the widget **target does not exist yet** — creating an
Xcode target means rewriting `project.pbxproj`, which is not safe to do blind.
It is a few clicks:

1. Xcode → File → New → Target → **Widget Extension**.
   - Name it `MatchLiveActivity`
   - Tick **Include Live Activity**, untick *Include Configuration Intent*
2. Delete the placeholder files Xcode generates in the new target.
3. Drag in from `ios/LiveActivity/`:
   - `MatchAttributes.swift` → **tick both** the `App` and `MatchLiveActivity`
     targets. It must belong to both or the activity silently never appears.
   - `MatchLiveActivity.swift` → widget target only.
4. `ios/App/App/LiveActivityPlugin.swift` is already in the app target and
   bridges it to JavaScript (`src/lib/live-activity.ts`).

Then from the web app:

```ts
import { startMatchActivity, updateMatchActivity, endMatchActivity } from "@/lib/live-activity";

await startMatchActivity({
  matchId, homeTeam: "Arsenal", awayTeam: "Chelsea",
  homeShort: "ARS", awayShort: "CHE",
  homeScore: 0, awayScore: 0, minute: "0'", status: "live",
});
```

All three are no-ops on the web, so they are safe to call from shared code.

## App Store review

A webview wrapper with no native capability is the classic rejection under
**Guideline 4.2 (Minimum Functionality)**. Push notifications and Live Activities
are what make this app defensible — ship them working, and say so in the review
notes. Submitting the shell on its own is likely to be rejected.

Include a demo account in App Review notes, since most of the app is behind sign-in.
