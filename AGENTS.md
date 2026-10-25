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
- iOS saves through the scene-registered add-only PhotoLibrary bridge; web uses sharing plus explicit download, never silent camera-roll downloads.
- Record and escalate bans with database triggers and per-user transaction locks, retaining history after restrictions are lifted; every write path must follow the same strike rules.
- AppShell owns gestures: resolve targets at touch start; club/competition pulls begin below sticky identity/tabs; other pages pull whole; bottom tabs stay fixed.
- Keep account/settings public via the Home profile icon; explicit sign-in CTAs preserve signed-out access to local preferences.
- Resolve portraits centrally with original fallbacks; one decoded batch reveals lineup players/coaches and club/national squads together.
- Reporter uploads use user-ID folders and active-reporter policies; admin access stays separate.
- Setup is device-local/hydration-safe; merge guest favourites idempotently on sign-in; no welcome repeats. Suggestions use current-season league joins; search spans all teams.
- Use one text-free loading overlay for both languages; keep pages mounted to preserve state.
- Touch fields are at least 16px; document touch-action: manipulation blocks focus/double-tap zoom but preserves pinch zoom.
- Round teams use terminal completion times and public read-only position ratings; available within one hour, without polling.
- Round-team formation maximizes position-average rating surplus, raw sum tie-break; show published history plus earliest started unreleased round.
- Keep season winners in owner-writable title history separate from cumulative title counts so editing a year never changes trophy totals.
- Alerts save instantly without replacing other preferences; club overrides remain separate from favourites. One stored-row sender records deliveries and per-alert sounds; club follows inherit into matches with per-match mute. One per-minute deduped server job sends reminders, never phone-local scheduling.
- Policies enforce submission ownership/state; deleting submissions removes reviews, never published articles.
- Use fixture row identifiers for club match scroll targets so Today and initial focus resolve the same next fixture in a descending list.
- Device-local language is authoritative on navigation; settings language changes sync immediately without reloading a stale profile language.
- President portraits use existing staff matched by chairman name/role; never invent identities.
- Club follower totals use a public aggregate-only function over private favourites; admin overrides affect display only, never real membership.
- Favourites/club alerts use ordered optimistic writes; ignore stale hydration; exclude buttons from gestures to prevent tap locks.
- Resolve retired country codes centrally and serve flag artwork from the local flag-icons package, so flags never use invalid external URLs.
- Content deletes archive per transaction to deleted_records; only owners restore via restore_deleted_batch.
- Voice uses LiveKit Cloud: server-signed joined-participant tokens, host/speaker-only publishing; presence carries roster/hands/moderation and clears same-topic leftovers. Host activity resets inactivity; safe discovery RPCs and owner-writable badges protect profiles.

- Social identity uses safe RPCs; recipient-only follow approval and shared database predicates secure private recordings. Triggered activity uses the stored-row sender and preferences; playback uses short-lived authorized links.
- Social dialogs portal for phone fit; reports use RLS and safe identity RPCs. Recording replies use one-level threads, likes use unique user/comment pairs, and reports keep database-stamped text snapshots for moderation after deletion.
- Verification review/replies use owner-authorized RPCs; owner badges derive from protected owner identity, never editable badge rows.
- Settings previews play one browser-compatible copy of bundled iOS audio at a time; refresh copies when CAF files change so phone sounds match.

- Stars/bells share sign-in-return and permission helpers; competition overrides inherit into match alerts. iOS bells light only after permission; denied permission runs mute_all_alerts (Apple prompts once).
- Blocks live in user_blocks via RPCs; triggers refuse follows, requests and recording interactions between blocked pairs (App Store rule).
- src/components has its own AGENTS.md; read it before changing files there.
- Home country discovery uses the shared upcoming-country grouping helper so past fixtures are excluded and friendly competitions are grouped consistently under World.

- Home match-calendar helpers centralize local-day keys and upcoming start boundaries so calendar markers and date filters agree across timezones.
- Competition round ordering uses the shared comparison helper so missing or rescheduled kickoffs never move numbered rounds out of sequence.
- Announced date-only fixtures store kickoff_date with NULL kickoff_at; use shared schedule formatting and ordering so unconfirmed times never become real kickoff instants or reminders.
- Shared card renderers finalize through one canvas export footer so every saved/shared image has consistent branding without obscuring content.
- Edge functions must not import from src/; deploys bundle only supabase/functions, so a shared import silently keeps the old sender live.
- Historical imports retain source attribution and label calculated ratings as estimates; validate fixture counts and starters with scripts/verify-rounds-1-6.sql to avoid fabricating future results. Source-calculated benches retain that distinction in match notes; scripts/mfsoccer_bench.py applies source participation/absence rules, and scripts/mfsoccer-bench-import.json records confirmed additions for repeatable auditing without inferring conflicting identities.
- Sofascore statistics imports reconcile completed fixtures by round, team pair and score, update only explicit valid match statistics, and retain a source audit; impossible values and incomplete shot totals are omitted rather than inferred.
- Possible lineups are read-only projections from the latest completed, published same-season competition lineup; never insert projections as confirmed match participants.
- Missing-player records use the match admin permission boundary and remain distinct from participating lineup rows.
- Match clock formatting uses a shared connection timezone store with device fallback; local clock-format choices take precedence over stale profile hydration.
- Refresh connection timezone on focus, visibility return and reconnection; ignore stale responses and clear old overrides when location metadata is unavailable.
- Event navigation uses the deduplicated participant list: one participant opens directly, multiple participants open the portrait chooser.
- Possible-lineup status travels with share data into the canvas export so projected lineups are never labelled as confirmed.
- Batch social-link AI only proposes existing squad IDs and exact supplied URLs; review and merge links without replacing unrelated networks.
- AFC Champions League Two syncs through an admin-triggered preview/confirm server function using the free API-Football plan's yesterday–tomorrow window; it links events only to existing squad players and never creates or edits player profiles.
