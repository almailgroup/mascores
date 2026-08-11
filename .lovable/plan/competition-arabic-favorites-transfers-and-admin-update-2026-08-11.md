# Competition, Arabic, favorites, transfers, and admin update

## What will change

### Competition overview
- Rebuild the overview to match the references: compact branded header with season selector, tabs, competition identity and dates, featured fixture, media rows, title-holder/most-titles blocks, and optional higher/lower division cards.
- Keep existing content such as sport, format, team count, awards, news, and linked navigation, but place it in the new hierarchy rather than removing it.
- Preserve the current professional match-list and standings tabs.

### Arabic switching
- Add a full-screen language-change loading state so partially translated English content is never shown while Arabic data is loading.
- Make translation readiness explicit: preload the cached dictionary, translate missing visible content in batches, and only reveal the page when the current language is ready.
- Audit fixed labels in the touched competition, player, favorites, match-list, and admin surfaces so they switch immediately, including dates, scores, status text, currency, and units.

### Player profile and transfers
- Reduce the player header scale to the compact reference proportions while keeping the portrait, team link, and favorite action.
- Redesign transfer history as clean chronological rows with destination club crest/monogram, club name, date, fee/type, and proper currency styling.
- Resolve saved clubs to existing team records for their logos; typed external clubs keep a polished monogram fallback.

### Favorites and match notifications
- Add a dedicated Favorites view with separate sections for matches, teams, players, and competitions, plus “View all” links from the home favorites area.
- Persist favorite matches for signed-in users in the profile, while retaining local favorites for signed-out visitors.
- Add match notification/bell controls. Favoriting a club automatically marks its fixtures as followed; users can still override individual match alerts.
- Surface followed/favorite matches reliably on the home page and favorites view.

### Admin match manager
- Recompose the match editor around the mobile references: match header, Info, Lineups, and Post-match sections; simple date/time/round/venue fields; list-or-pitch lineup setup; clear team/player selection; match status confirmation; and event controls with editable timeline rows.
- Retain the existing capabilities absent from the screenshots: referee, highlights, notes, live timer, predictions, statistics, channels, media, substitutions, cards, penalties, and lineup publishing.
- Keep desktop usable while prioritizing an iPhone-friendly single-column flow with stable sizing and no zoom-out.

### Admin access and backend check
- Keep the current admin password and add `200903` as a second server-only password; neither password will be exposed in browser code.
- Verify the live database connection and the reads/writes used by competitions, favorites, transfers, and admin match management.
- Add only the minimal profile fields needed to persist favorite matches and per-match notifications, with existing profile RLS retained.

## Technical notes
- Database schema changes will be applied through a migration and will not weaken existing row-level security.
- The admin unlock comparison remains timing-safe and rate-limited.
- Existing design tokens, dark/light themes, bilingual direction handling, and reusable team/player crest components remain authoritative.
- Additional admin screenshots sent afterward can refine the same match-management structure without replacing the retained controls above.
