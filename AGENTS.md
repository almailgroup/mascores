<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store reporter identity photos in private user-scoped storage and issue short-lived owner-authorized links; identity documents must never have public URLs.
- Keep shared-image generation and saving in one share dialog, with cancellable rendering and revoked preview URLs, to prevent redundant work and memory leaks.
- Save images on iOS through the add-only PhotoLibrary bridge registered by the scene controller; web uses file sharing with an explicit download alternative so camera-roll actions never silently download.
- Record and escalate bans with database triggers and per-user transaction locks, retaining history after restrictions are lifted; every write path must follow the same strike rules.
- Use the shared AppShell gesture controller: club/competition refresh opens below the sticky identity and tabs while other pages pull as a whole; resolve targets at touch start so asynchronously loaded pages work; never move fixed bottom tabs.
- Keep account/settings public and reachable from the Home profile icon; signed-out visitors enter the existing authentication page through an explicit account CTA, so local preferences remain accessible without a session.
- Serve optimized portrait asset copies through a shared portrait resolver while retaining original URLs as fallbacks; this reduces repeated photo transfers without changing stored originals.
- Scope reporter news uploads to their user-ID folder and active reporter storage policies; administrator upload access stays separate.
- Keep first-run setup completion device-local and retain guest team favourites with idempotent profile merging on sign-in, so onboarding works without an account and never repeats on ordinary launches.
- Use one text-free branded loading overlay for both language directions, keeping underlying pages mounted to preserve navigation and form state.
- Use the shared scroll-driven collapsing-header hook for club, competition and match headers; identity and tabs remain one sticky unit for consistent scrolling.
- Calculate round teams from terminal match completion timestamps and actual position ratings through the public read-only function, with a one-hour availability deadline; avoid recurring background polling.
- Keep season winners in owner-writable title history separate from cumulative title counts so editing a year never changes trophy totals.
- Gate welcome UI until local completion is checked to prevent repeat setup flashes; keep rendering hydration-safe.
- Store per-club alert overrides separately from favourites and preserve other notification preferences on writes, so the bell never changes the star.
- Use the shared SportsHeaderBackground with semantic surface tokens and sampled logo colours for sports identity headers; one backdrop keeps their visual treatment consistent without changing stored artwork.
- All public standings default to the shared modern StandingsTable with position-label and row-qualification fallbacks, so club, competition and match views stay consistent.
- Use the shared portalled SeasonMenu for season and round selection, with display formatting separate from stored values, so sticky headers cannot clip keyboard-accessible in-app menus.
- Portal ticket overlays outside the browsing wrapper and lock background scrolling so page transforms and bottom navigation cannot clip ticket actions.
- Enforce submission ownership and approval-state editing through database policies; deleting a submission removes the review record, not a separately published news article.
- Use fixture row identifiers for club match scroll targets so Today and initial focus resolve the same next fixture in a descending chronological list.
- Device-local language is authoritative on navigation; settings language changes sync immediately without reloading a stale profile language.
- Resolve club president portraits from existing team staff by chairman name or president role; never invent identity images.
