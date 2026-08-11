# Fix season isolation and match management

## What will change

### 1. Strict season isolation
- Stop treating records with no season as belonging to every selected season.
- Backfill the existing Zain Premier League matches, competition teams, and standings rows with its current `2026/2027` season so they remain visible only there.
- Apply exact season filters in Admin and public competition views, including standings labels and title counts where season data supports it.
- Reset season-sensitive screens and queries immediately when the season picker changes.

### 2. Public match page
- Hide the timeline before a match starts; show it only once the match is live or completed.
- Hide the Lineups tab until lineups have been added and explicitly published by Admin.
- Keep Media as its own tab, remove the separate Chat/media combination, and place Match Chat inside Details beneath the match information/watch sections.
- Show predictions only before kickoff; replace club names in prediction choices with club crests while keeping Draw clear.
- Replace the top competition text with a compact competition identity row: logo, sport, country, competition name, and round.
- Show Match information in this order: competition, date/time, stadium, city, referee. Omit any unavailable optional row instead of showing a dash.
- Always show a separate “Where to watch” box; when empty, display “No channel yet.”
- Display the Admin-controlled running clock/minute in the match header and match rows. Ensure HT is only used when the status is actually half-time.
- Surface postponed, cancelled, interrupted, and awarded states clearly in match lists and the match header.

### 3. Admin lineup editor
- Make Formation pitch work immediately with `4-2-3-1` as the default for both teams, without requiring a formation selection first.
- Replace cramped slot dropdowns with a comfortable player picker opened from each pitch position.
- Group eligible players by Goalkeeper, Defender, Midfielder, and Forward; show photo, shirt number, name, and position.
- Preserve lineup publishing so unfinished lineups remain hidden from visitors.

### 4. Admin live and result controls
- Keep `live_minute` synchronized with the running match clock so public views update correctly in real time.
- Separate non-playing states from live event controls.
- For Awarded, provide a score-only result workflow; no timer or event entry is required.
- Make cancelled, postponed, and interrupted updates stop the timer and immediately propagate to public match rows.

## Technical notes
- Frontend changes will use existing realtime subscriptions and semantic design tokens.
- Existing rows will be updated through a data operation; no new database table is required.
- Verification will cover season switching, pre-match/live/half-time/special statuses, lineup publication, prediction cutoff, and mobile lineup selection.
