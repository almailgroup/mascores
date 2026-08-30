# Player, translation, standings, seasons, pitch, and voice fixes

## What will change

### Player club selection
- Replace the native club dropdown in the player editor with an in-app searchable club picker showing crests, selected club, and a clear “Free agent” option.
- Reuse the same searchable picker for squad transfers so large club libraries remain easy to navigate.

### Arabic translation experience and corrections
- Change Arabic switching into one blocking preparation flow: keep the full-screen branded loading screen visible while the existing dictionary loads and the current page’s missing content is translated, then reveal the fully translated page.
- Stop the loading screen from returning on every tab click or route interaction by keeping the Arabic dictionary/session readiness stable after the initial language switch and translating newly encountered strings without repeatedly hiding the page.
- Add editable Arabic overrides in Admin for names and text that can be machine-translated incorrectly, covering teams, players, competitions, coaches, venues, and news. Saved overrides will take priority over generated translations everywhere.

### Website-styled season selectors
- Replace native season `<select>` controls with the project’s styled dropdown component on public competition pages and in the Admin competition header, including create/delete season actions in Admin.

### Lineup pitch ratings
- Adjust pitch row sizing and player-card overflow so goalkeeper ratings, kit numbers, names, and event icons remain visible in every supported formation on both Admin and public match views.
- Preserve a fixed pitch aspect ratio while reserving enough space at the top and bottom for overlays.

### Club standings parity
- Extract one reusable standings table used by both competition and club pages.
- Make club standings season-aware and show the same groups, columns, position colors, qualification labels, legend, ordering, and selected-season data as the competition standings, while highlighting the current club.

### Voice rooms
- Repair microphone startup and WebRTC renegotiation so hosts and promoted speakers can unmute and be heard, with reliable participant presence and speaker/listener counts.
- Add host controls to mute speakers, promote/demote participants, end a room, and permanently delete a room after confirmation.
- Keep public listening simple: users join as listeners, raise a hand to request speaking, and only capture microphone audio once they are a host or approved speaker.

## Backend changes
- Add optional Arabic override fields for core football entities, preserving existing English fields and access rules.
- Add secure authenticated server operations for voice-room host actions where client-only updates are not reliable enough, while retaining current ownership checks and row-level security.

## Verification
- Verify searchable selectors and season menus on desktop and mobile-sized viewports.
- Switch English to Arabic and navigate through several tabs/routes to confirm one loading screen and persistent corrected names.
- Check multiple formations, especially goalkeeper cards, in Admin and public match lineups.
- Compare the same competition/season standings from competition and club pages.
- Test host and listener voice-room flows in separate browser contexts, including speaking, mute, promotion, ending, and deletion.
