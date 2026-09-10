# Roadmap

## A. Bug fixes (done)
- [x] Rating colour bands (purple → shiny gold) + always one decimal (7.0)
- [x] ft/in height unit working globally (settings + player profile)
- [x] Pitch stays the same size for every formation / with ratings
- [x] Group B (and later groups) can now receive teams via "Add teams"
- [x] Standings competition bar with tournament logos on club pages
- [x] National teams no longer repeat the country row
- [x] "Bidoon" nationality with an Arabic wordmark flag
- [x] "Save result" prompt when goals are logged on a scheduled match

## B. Admin usability (done)
- [x] Search + filter bars across every admin list (teams, players, matches,
      competitions, venues, channels, transfers, news)
- [x] Past-season squads start empty; can pull current or past players

## C. Branding & content
- [x] Zain Premier League themed competition page + 5s intro with smooth theme

## D. New features
- [x] Tickets: admin creation (optional row/seat, free tickets), QR per ticket,
      single-use scanner in admin, public ticket section, "Pay — coming soon",
      admin code MAMA2026 for a free ticket
- [x] Voice chats: create room with title/photo (auto-generated when missing),
      public or link-only, follow users + notifications, most-followed feed

## E. Follow-ups (done this pass)
- [x] Database access grants for tickets, voice rooms and follows
- [x] Ticket checkout: details → payment (coming soon + skip) → generated QR pass
- [x] Voice: end room, mic publishing fix, speaker/listener counts, anonymous listening
- [x] Reporter publishing marked coming soon
- [x] Club pages show competition stats leaderboards

## Follow-up round (in progress)
Done in this pass:
- Host can delete a voice room at any time (live rooms are ended first); clearer mic errors + Retry microphone button.
- Zain theme/intro limited to the Premier League only (First Division back to default look).
- Season picker moved out of the hero metadata row, styled for coloured heroes, no longer clipped.
- Pitch layouts (admin + public) reserve space so goalkeeper ratings/kit numbers are never cut off.
- Tickets: full-page checkout with safe bottom spacing, passes expire 3h after kickoff, expired offers leave the shop, home page "Buy match tickets" banner, admin Hide/Show toggle and Buyers contact list.
- Search: coloured sticky header with back arrow, rounded field, filter chips and a recent-entities list.
- "Scroll for more" hint on match and competition pages.
- News article: duplicate Back control removed (News link kept).

Still open (needs DB columns — migration pending):
- Per-match coach: assign or remove a coach for a single match.
- Admin ban / timed suspension of users (chat + voice + tickets).
- Club and player social media links section.
- Competition logo variants for light and dark mode.
- Link a voice room to a match and show a voice section on the match page.
- Transfer history: upload a crest for a club typed by name only.
Still open (frontend polish):
- Richer awards/winner presentation and a more premium competition overview info box.
- Confirm the "publish news" action is fully removed for reporters.

## Done in this pass
- Per-match coach picker (admin) and match-specific coach display
- Users & moderation admin tab: ban / timed suspension / lift, enforced in chat + ticket claims
- Social media links for clubs and players (admin editor + public section)
- Light/dark competition logos everywhere (hero, intro, list)
- Voice rooms linked to matches, with a voice section on the match page
- Transfer history club crest uploads and public display
- Professional awards board and premium competition key-numbers strip

## Still open
- [x] Voice entry now reports failed joins instead of opening a broken room
- [x] X-style listen-first flow with hand raising, host promotion, participant counts and explicit mobile audio unlock
- [x] Microphone starts from the user's tap, reconnects peers with ICE restart, and queues early connection candidates
- Voice audio still needs final two-account verification on physical devices

## Voice replays pass
- [x] Hosts can record a room and save it as a replay (mixed audio upload)
- [x] Replays listed on the voice page, on linked match pages, and in account settings
- [x] Admin voice tab: browse rooms/replays, end, delete
- [x] Anonymous listening stored per participant and masked in the roster
- [x] Optional match link when starting a room from the voice page

## Big request (Sep 10) — tracking list
Fixes:
- [x] Admin on iPhone: nothing cut off (delete competition, add season, all panels)
- [x] Voice: bottom nav covers the "create room" button
- [x] Search: country results must not repeat the country name
- [x] Ban / suspend a user does not take effect
- [x] "Edit player" should jump straight to the editor
- [x] Match page background too bright
- [x] Brand name -> "Mansour Almail Scores" (with space), smaller
- [x] Back button on competition pages
- [ ] National-team squad photo should persist on the player page (squad entry only)
Additions:
- [ ] Share button on standings and line-ups + save to camera roll
- [ ] Line-ups: choose formation+bench or names/numbers+bench
- [ ] Club Info tab: one news preview + "more news"
- [x] Settings: send feedback to the owner
- [ ] Stadium: map link + "directions"; stadium shown under match
- [ ] Club contact info; full staff (not only coach); club/national colour choice
- [ ] National team squad: player's club shown next to the name
Bigger builds (need database work):
- [ ] Main admin (mansouralmailscores@gmail.com) at /secretadminsafha, everyone else signed out
- [ ] Manage section: create users with limited access (news, club news, rabta), approval on/off, generated passwords
- [ ] Ultras / Rabta section with per-club editors and approval
- [ ] Public/private user profiles, usernames, followers; replays published to the host profile
- [ ] Voice rooms: live text messages during the room
- [ ] Admin moderation of match chat messages
- [ ] Tickets: Apple Wallet, resale with price cap, new QR after resale, seller contact
- [ ] Match reminders + 45/30/15 minute notifications
- [ ] Reporter desk: contact mansouralmailscores@gmail.com, social accounts on published news
