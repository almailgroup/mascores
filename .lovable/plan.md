
# MansourAlmailScores — Admin-driven rebuild

This is a big pivot: the app becomes a **content platform you fully control from an admin panel**, not a live-scores wrapper around a third-party API. Everything a fan sees (matches, teams, players, standings, news) is data you enter in the admin. Real-time sync means the moment you save, every open browser updates.

Because this rebuild is large, I'll ship it in ordered phases. Each phase leaves the app working — nothing half-broken.

## Phase 1 — Cleanup + branding + icon + settings shell

- Remove API-Football entirely: delete `football.functions.ts`, `football.ts`, `football-fallback.ts`, and every route that queries them (search results, competitions/$id current data source, teams/$id current data source, players/$id, countries/$name, world-cup-2026 current shell). We keep the route shells and rewire them to the new database in later phases.
- Delete competition scaffolding for Premier League / LaLiga — World Cup 2026 becomes the only pre-seeded competition (you can add more via admin).
- New app icon from your uploaded MA logo: background removed, saved as Lovable Asset, used as the top-left header logo (icon variant) + favicon.
- Trim homepage hero copy: drop "Live Scores. Real Passion." block and the "Premier League 2025/26 / LaLiga 2025/26" line. Hero focuses on WC 2026 + your competitions.
- Header: replace the profile-avatar link with a **Settings** button (gear icon). Settings page holds: profile info, avatar, display name, language, theme (dark/light/system), notifications, sign out, and an **Admin only** entry at the bottom.
- Google sign-in consent screen: the "Lovable" name shown to Google is controlled by whose OAuth client is used. Managed Google OAuth (default) uses Lovable's client, so Google's consent page shows Lovable. To show *MansourAlmailScores* instead, you must supply your own Google OAuth Client ID + Secret (branded to your app in Google Cloud Console). I'll add a short in-app note on the settings page explaining this and how to configure it — the actual Google Cloud Console setup is done by you outside Lovable, then pasted into the Cloud auth settings.

## Phase 2 — Data model (the backbone)

New tables in Lovable Cloud with RLS. Public can read everything; only admins can write. Realtime enabled on all of them so saves propagate live.

- `admins(user_id)` — who has admin rights. Password `MAMA2026` grants admin on the currently signed-in account (see Phase 3 for gating).
- `competitions` — name, sport, country, category, logo_url, starts_on, ends_on, format (`league` | `groups_knockout` | `knockout` | `custom`), season, slug, description.
- `teams` — competition_id, name, short_name, country, logo_url, coach_name, coach_photo_url, venue_name, venue_city.
- `players` — team_id, name (required; everything else optional), position, shirt_number, height_cm, dob, nationality, photo_url.
- `matches` — competition_id, round, home_team_id, away_team_id, kickoff_at, venue, status (`scheduled` | `live` | `ft` | `aet` | `pen` | `postponed` | `cancelled` | `awarded` | `interrupted`), home_score, away_score, home_pen, away_pen, notes.
- `match_events` — match_id, minute, extra, type (`goal` | `own_goal` | `penalty` | `missed_penalty` | `yellow` | `red` | `second_yellow` | `sub`), team_id, player_id, assist_player_id, sub_out_player_id, description.
- `match_lineups` — match_id, team_id, player_id, is_starting, position_code, shirt_number.
- `standings_rows` — competition_id, group_label (nullable), team_id, played, won, drawn, lost, gf, ga, points, points_adjust (manual +/-), sort_order, qualification_label, qualification_color.
- `news_posts` — title, slug, cover_url, body_markdown, published_at, author_display.

RLS pattern for every table: `SELECT` open to anon+authenticated; `INSERT/UPDATE/DELETE` restricted to `public.has_admin(auth.uid())`. GRANTs included per project rules. Realtime enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.

## Phase 3 — Admin section

- Route: `/admin`, linked from Settings ("Admin only"). Blocks the page unless the signed-in user is in `admins`.
- First-time unlock: page prompts for the password `MAMA2026`. On correct entry, a server function verifies the password against a server-only secret and inserts `(auth.uid())` into `admins`. From then on the user is admin — no re-prompt.
- Admin dashboard tabs:
  1. **Competitions** — list + create/edit/delete. Fields: name, sport, country, category, logo (upload to Storage), duration (start/end), format, season, description. Clicking a competition opens its detail workspace.
  2. Inside a competition:
     - **Teams** — add/edit/delete teams (logo, name, country, coach, coach photo, venue). Editing a team opens its **Squad** editor: add players with optional position, height, shirt number, DOB, nationality, photo.
     - **Matches (calendar view, Torneo-style)** — month calendar showing every match. Click empty day to create a match; click existing match to edit date/time/round/venue, set status (scheduled/live/FT/AET/pen/postponed/cancelled/awarded/interrupted), enter score + penalty score, manage **lineups** (starting XI + bench from the team squads), and add **live events** (goal, yellow, red, sub, own goal, missed pen) with minute + extra time.
     - **Standings** — auto-computed from matches, but with manual overrides: reorder rows (drag), add/deduct points (`points_adjust`), and per-row qualification label + color (e.g. "Round of 16" green, "Playoff" amber, "Eliminated" red). Editable label text and color picker.
  3. **News** — add/edit/delete posts with cover image, title, markdown body, publish date.

## Phase 4 — Public site rewired to your data

- Home: hero + your competitions grid + upcoming matches (from `matches` where kickoff >= today) + latest news. All realtime — new insert in admin appears instantly.
- `/competitions` — grid of all competitions you've created.
- `/competitions/$id` — overview, standings (with your labels + colors), matches list grouped by round, teams grid.
- `/matches/$id` — match center: scoreboard (with status badge for AET/pen/postponed/etc), timeline from `match_events`, both lineups (players clickable), venue info.
- `/teams/$id` — squad, coach, venue, upcoming + recent matches.
- `/players/$id` — bio (photo, dob, height, nationality, position, shirt), match history / goals from `match_events`.
- `/world-cup-2026` — pinned entry that opens the WC 2026 competition detail with a bespoke hero (still the same underlying data — you edit it in admin like any other competition, it's just featured on the home page).
- `/news` and `/news/$slug` — real content from `news_posts`.
- `/search` — searches across teams, players, competitions, coaches, venues, countries from your DB.
- `/favorites` — unchanged behaviour, now over your data.
- Every page subscribes to Supabase Realtime for its tables and refetches on change.

## Phase 5 — Arabic + i18n

- Add `i18next` + `react-i18next`. Two locales at launch: `en`, `ar`. Every user-facing string moved into translation files (`src/i18n/en.json`, `src/i18n/ar.json`). Language chosen in Settings; persisted to `profiles.language`. When `ar` is active, `<html dir="rtl">` is set and layout mirrors correctly (Tailwind logical properties + `dir="rtl"` on `<html>`).
- Includes admin UI translations too.

## Phase 6 — WC 2026 seed data

Prepopulate the World Cup 2026 competition with:
- Competition record (dates 11 Jun – 19 Jul 2026, format `groups_knockout`, host countries US/Canada/Mexico, official logo).
- All 48 qualified/expected teams once groups are drawn (I'll seed the confirmed qualifiers as of today, and you can top up the rest from admin as CONMEBOL/UEFA/CAF/AFC/CONCACAF/OFC playoffs finalize).
- Group-stage fixtures with venues (16 host cities) once the draw fixtures are public.
- All of this seeded via a migration so it's real DB rows, not code — you can edit anything from admin.

Note: I'll pull what's publicly confirmed. Where draw-dependent details aren't public yet, I'll seed placeholders you can fill in.

## Technical section

- Stack unchanged: TanStack Start + Lovable Cloud (Supabase). No third-party sports API. Everything reads/writes through `createServerFn` or `supabase` client with RLS.
- Admin gate: `public.has_admin(uuid)` security-definer function used in every write policy. Password check happens in a server function reading `ADMIN_UNLOCK_PASSWORD` from server env (I'll add it as a secret so the literal `MAMA2026` doesn't sit in the repo).
- Realtime: enabled per table via publication ALTER; client subscribes in `useEffect` with `supabase.channel(...)` and cleans up on unmount.
- Media uploads (logos, player photos, news covers): reuse `avatars` bucket pattern with new buckets `competition-logos`, `team-logos`, `player-photos`, `news-covers` (public read, admin-only write).
- Standings recompute: a Postgres function `recompute_standings(competition_id)` runs after any match FT/AET/PEN insert or update via trigger; `points_adjust` and `sort_order` overrides are respected.
- Google OAuth branding: requires user to bring their own OAuth client — cannot be changed from inside code alone.

## Order of work (what I'll do first once you approve)

1. Phase 1 (cleanup, icon, settings shell).
2. Phase 2 migration (all tables, policies, realtime, storage buckets).
3. Phase 3 admin UI end-to-end.
4. Phase 4 public rewire.
5. Phase 5 Arabic i18n pass.
6. Phase 6 WC 2026 seed.

Approve this and I'll start on Phase 1 immediately. If you want any part descoped (e.g. skip Arabic for now, or keep PL/LaLiga as empty admin-editable competitions), tell me before approving and I'll adjust.
