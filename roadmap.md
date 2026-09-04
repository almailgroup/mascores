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
