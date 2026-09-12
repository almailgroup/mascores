# Mobile, Arabic, notifications, voice, and admin improvements

## What will change

- Rework the iPhone home experience: a simpler ticket entry, compact match cards, a date strip with a calendar sheet, and safe spacing below the top and bottom bars.
- Refine mobile club and match headers with favorite/notification controls, pre-match alerts, completed-result indicators, and event-specific scorer icons.
- Fix Arabic competition overrides, stable home/away color assignment, lineup team switching, and editable Arabic player short names.
- Replace “Bidoon” with “No nationality” and allow national teams created in the app to appear as nationality choices.
- Add advanced alert preferences and sounds for goals, cards, kick-off, reminders, and followed voice hosts; keep in-app alerts as the fallback when system notifications cannot run.
- Improve voice rooms with reactions, smoother message updates, mobile-safe controls, an End-first lifecycle, and a clear private/public replay choice before deletion becomes available.
- Let users hide and restore tickets, while preserving existing resale and QR safety behavior.
- Make feedback a visible conversation: the owner can reply under each message and the sender can see the reply in Settings.
- Complete the reporter desk at 3 KWD, keep applications and submissions in the owner portal, and preserve approve/reject status for reporters.
- Strengthen owner chat moderation by showing active match conversations with message deletion and direct account restriction controls.
- Add a subtle Mansour Almail Scores watermark overlay to news, player, and coach photos without modifying the original uploads.
- Fix stadium pages so matches linked by either stadium ID or the existing stadium-name field appear together.

## Technical details

- Add narrowly scoped database fields/tables for feedback replies, hidden tickets, and voice reactions, with explicit grants, row-level policies, and realtime publication where needed.
- Keep alert preferences in the existing profile preference object and add sound previews; browser-open reminders and realtime events work immediately, while true closed-app push remains limited by browser/PWA delivery support.
- Resolve venue matches by `venue_id` plus normalized legacy venue names, then de-duplicate results.
- Make Arabic override saves update the local translation cache immediately, preventing stale English labels after an edit.
- Preserve semantic design tokens and existing access controls; owner-only areas remain restricted to the configured main-owner account.

## Validation

- Test the home, match, club, Settings, tickets, voice, reporter, venue, and owner pages at iPhone and desktop sizes.
- Verify Arabic team colors and lineup switching using a real match, and confirm feedback replies, ticket hiding, voice reactions, and stadium match results against the live backend.
- Run focused checks and inspect screenshots for clipped controls, overlapping bars, and translated labels.
