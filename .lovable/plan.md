## Scope

This request covers ~40 distinct changes across the admin CMS, public pages, AI features, auth and security. It's far too much for one safe pass, so it's split into phases that each ship something working. I'll start at Phase 1 and continue down the list; tell me if you want a different order.

---

### Phase 1 — Foundations (data + fixes you'll feel immediately)

Database additions:
- `teams`: `founded_on`, reusable across competitions (team library, decoupled from a single competition)
- `venues`: images, capacity, city/country — editable as its own admin section
- `competitions`: `sport` (football, basketball, American football, hockey, …), `season` list, `title_holder_team_id`, `higher_division_id`, `lower_division_id`, `format` (league / groups / knockout / groups+knockout)
- `matches`: `referee`, `highlight_url`, `round_number` (numeric only)
- new tables: `broadcast_channels` (name + logo, saved for reuse), `match_broadcasts`, `match_chat_messages`, `player_ratings`, `player_media` (with `source`: youtube/facebook/instagram/tiktok/upload), `competition_awards` (player of round / player of season), `match_stats`, `match_predictions`
- `player_media`/`team_media`/`match_media` replace the plain URL arrays so social embeds work

Immediate fixes in the same phase:
- Transfers page: only current season (26/27); full history stays on the player profile
- Transfers page redesign
- Player profile shows date of birth (not just age)
- Match round shows "Round 1" everywhere; admin enters a number only
- Settings page works when signed out — only the profile block shows "Sign in"
- Remove all "Sync" buttons; everything saves automatically
- Remove the "Done" button in player editing
- White version of the logo mark for dark mode
- Sign-in screen no longer shows the Lovable consent wording
- Security review + fixes

### Phase 2 — Admin rebuild (simpler + mobile friendly)

- Full mobile-first admin layout (no more page zoom-out on phone)
- Simplified match manager: one screen per match with clear steps
- Visual lineup board: pick a formation (4-3-3 etc.), drag existing players onto slots, "Confirm" before it goes public; or the simple names+numbers mode
- Standings: add/remove teams per group with buttons
- Team library: "Add existing team" when building a new competition; team data persists
- Squad: "Add existing player" — moving a player auto-writes a transfer and removes them from the old club
- Transfers editor: admin can enter clubs not in the system
- Separate venue editor with images
- Media manager: upload or paste YouTube / Facebook / Instagram / TikTok links
- Image cropper on every upload, plus re-crop of existing images; news covers no longer crop badly
- Competition editor: sport, format, seasons, title holder, divisions, player of the round/season, ratings
- Channel editor with logos, saved for reuse

### Phase 3 — Almail AI

- Almail AI player creator: attach one or several photos or free text → generates a full player card for review
- Almail AI news writer: attach a photo and/or notes → generates the article
- Almail AI translator: automatic Arabic translation of stored content (team names, player names, news) with caching, so switching to Arabic translates everything

### Phase 4 — Public pages

- Competition page: seasons selector at the top; bar 1 info (title holder, team count, duration, divisions, promoted/relegated), bar 2 matches with filters (date / group / round / team), bar 3 standings
- Match page: bar 1 details (competition + round, highlight, timeline with clickable scorers, lineups with player faces, player of round/season, prediction, date/time/country/stadium/referee, where to watch with channel logos), bar 2 lineups (with card/sub symbols), bar 3 stats + standings, bar 4 previous matches, bar 5 videos/media
- Match chat box for signed-in users, with a profanity filter
- Upcoming matches show competition logo, name and country, clickable to the competition
- Favorites shows favorite competitions, teams and players
- Player ratings shown with a colour scale (green = best)
- Profile: display name + new profile picture upload
- Settings: cm / feet toggle

---

## Technical notes

- All new public tables get GRANTs plus RLS: public read, admin-only write via `is_admin()`. Chat messages: signed-in insert, own-row delete, admin moderate.
- AI features run through Lovable AI on the server (`createServerFn`), with image input for the player-card and article generators.
- Arabic translation is cached in a `translations` table keyed by source text + locale, so each string is translated once.
- Team reuse means `teams.competition_id` becomes advisory only; membership lives in `competition_teams` (already present).
- Realtime stays on for matches, events and standings.
