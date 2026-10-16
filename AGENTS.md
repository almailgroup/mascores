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
- Keep shared-image generation and saving in one share dialog, with cancellable rendering and revoked preview URLs, to avoid redundant work and memory leaks.
- Save images on iOS through the add-only PhotoLibrary bridge registered by the scene controller; web uses file sharing with an explicit download alternative so camera-roll actions never silently download.
- Record and escalate bans with database triggers and per-user transaction locks, retaining history after restrictions are lifted; every write path must follow the same strike rules.
- Use the shared AppShell gesture controller: club/competition refresh opens below the sticky identity and tabs, other pages pull as a whole; resolve targets at touch start; never move fixed bottom tabs.
- Keep account/settings public and reachable from the Home profile icon; signed-out visitors reach the authentication page via an explicit account CTA, so local preferences stay available without a session.
- Resolve optimized portraits centrally with original-URL fallbacks to reduce transfers without changing originals.
- Scope reporter news uploads to their user-ID folder and active reporter storage policies; admin upload access stays separate.
- Keep first-run setup completion device-local, merge guest team favourites idempotently on sign-in, and gate welcome UI hydration-safely, so onboarding never repeats or flashes.
- Use one text-free loading overlay for both languages; keep pages mounted to preserve state.
- Keep touch fields at least 16px and document touch-action: manipulation to prevent focus/double-tap zoom while preserving pinch zoom.
- Use the shared scroll-driven collapsing-header hook for club, competition and match headers; identity and tabs remain one sticky unit for consistent scrolling.
- Calculate round teams from terminal match completion timestamps and position ratings through the public read-only function, with a one-hour availability deadline; avoid background polling.
- Choose the legal round-team formation by how far selected players beat their position's round average (raw rating sum tie-break), so position rating bias never fixes one shape; expose published history plus only the earliest started unreleased round.
- Keep season winners in owner-writable title history separate from cumulative title counts so editing a year never changes trophy totals.
- Store per-club alert overrides separately from favourites and preserve other notification preferences on writes, so the bell never changes the star.
- Use the shared SportsHeaderBackground with semantic surface tokens and sampled logo colours for sports identity headers; one backdrop keeps their visual treatment consistent without changing stored artwork.
- All public standings use the shared modern StandingsTable with position-label and row-qualification fallbacks, so views stay consistent.
- Use the shared portalled SeasonMenu for season, round and club-standings competition selection, with display formatting separate from stored values, so sticky headers cannot clip keyboard-accessible in-app menus.
- Portal ticket overlays outside the browsing wrapper and lock background scrolling so transforms and bottom navigation cannot clip them.
- Enforce submission ownership and approval-state editing through database policies; deleting a submission removes the review record, not a published article.
- Use fixture row identifiers for club match scroll targets so Today and initial focus resolve the same next fixture in a descending list.
- Device-local language is authoritative on navigation; settings language changes sync immediately without reloading a stale profile language.
- Resolve club president portraits from existing team staff by chairman name or president role; never invent identity images.
- Club follower totals use a public aggregate-only function over private favourites; admin overrides affect display only, never real membership.
- Use TeamCrest for missing club artwork and localized free-agent labels for unattached players so national call-ups never imply club membership.
- Update favourites and club alerts optimistically with ordered writes and ignore stale profile hydration; exclude buttons from page gestures so one tap never locks navigation.
- Resolve retired country codes centrally and serve flag artwork from the local flag-icons package, so flags never use invalid external URLs.
- Content-table deletes are archived by a BEFORE DELETE trigger into deleted_records (grouped per transaction) and restored only by the owner via restore_deleted_batch, keeping every deletion recoverable.
