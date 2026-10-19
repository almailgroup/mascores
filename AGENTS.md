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

- Reporter ID photos stay private/user-scoped with short-lived owner-authorized links; never public URLs.
- One dialog generates/saves images; cancel rendering and revoke previews to avoid duplicates/leaks.
- iOS saves through the scene-registered add-only PhotoLibrary bridge; web uses sharing plus explicit download, never silent camera-roll downloads.
- Record and escalate bans with database triggers and per-user transaction locks, retaining history after restrictions are lifted; every write path must follow the same strike rules.
- AppShell owns gestures: resolve targets at touch start; club/competition pulls begin below sticky identity/tabs; other pages pull whole; bottom tabs stay fixed.
- Keep account/settings public via the Home profile icon; explicit sign-in CTAs preserve signed-out access to local preferences.
- Resolve portraits centrally with original fallbacks; one decoded batch reveals lineup players/coaches and club/national squads together.
- Reporter uploads use user-ID folders and active-reporter policies; admin access stays separate.
- Setup stays device-local and hydration-safe; merge guest favourites idempotently on sign-in; no welcome repeats/flashes.
- Use one text-free loading overlay for both languages; keep pages mounted to preserve state.
- Touch fields are at least 16px; document touch-action: manipulation blocks focus/double-tap zoom but preserves pinch zoom.
- Collapsing headers keep identity and tabs sticky.
- Round teams use terminal completion times and public read-only position ratings; available within one hour, without polling.
- Round-team formation maximizes position-average rating surplus, raw sum tie-break; show published history plus earliest started unreleased round.
- Keep season winners in owner-writable title history separate from cumulative title counts so editing a year never changes trophy totals.
- Alerts save instantly without replacing other preferences; club overrides remain separate from favourites. One stored-row sender records deliveries and per-alert sounds; club follows inherit into matches with per-match mute. One per-minute deduped server job sends reminders, never phone-local scheduling.
- SportsHeaderBackground uses semantic surfaces and sampled logo colours, preserving artwork.
- Public standings share StandingsTable with position-label/qualification fallbacks.
- Portalled keyboard-accessible SeasonMenu selects seasons, rounds and club competitions; separate labels from stored values to prevent header clipping.
- Portal ticket overlays outside the browsing wrapper and lock background scrolling so transforms and bottom navigation cannot clip them.
- Policies enforce submission ownership/state; deleting submissions removes reviews, never published articles.
- Use fixture row identifiers for club match scroll targets so Today and initial focus resolve the same next fixture in a descending list.
- Device-local language is authoritative on navigation; settings language changes sync immediately without reloading a stale profile language.
- President portraits use existing staff matched by chairman name/role; never invent identities.
- Club follower totals use a public aggregate-only function over private favourites; admin overrides affect display only, never real membership.
- Use TeamCrest for missing club artwork and localized free-agent labels for unattached players so national call-ups never imply club membership.
- Favourites/club alerts use ordered optimistic writes; ignore stale hydration; exclude buttons from gestures to prevent tap locks.
- Resolve retired country codes centrally and serve flag artwork from the local flag-icons package, so flags never use invalid external URLs.
- Content deletes archive per transaction to deleted_records; only owners restore via restore_deleted_batch.
- Voice audio runs through LiveKit Cloud (server-signed tokens only for joined participants; only hosts/speakers can publish) so rooms scale to 100+ and pass carrier firewalls; a realtime presence channel carries roster, hands and moderation, and fully removes same-topic leftovers before rejoining. All host activity resets inactivity. Safe discovery RPCs and owner-writable badges protect profiles.
- Stars/bells share sign-in-return and permission helpers; stored competition bell overrides inherit into match alerts.

- Social identity uses safe RPCs; recipient-only follow approval and shared database predicates secure private recordings. Triggered activity uses the stored-row sender and preferences; playback uses short-lived authorized links.
- Social dialogs are portalled for phone fit; share/report controls are reused; reports use RLS and safe identity RPCs.
- Verification review/replies use owner-authorized RPCs; owner badges derive from protected owner identity, never editable badge rows.
- Avatar uploads use user-ID folders; crop dialogs portal outside page gestures to keep touch editing stable.
