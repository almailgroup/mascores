# Roadmap

- [x] Separate match date from team names; suppress knockout group labels; create 50 verified profiles and reuse seven existing profiles, filling 185 match lineup entries. Forty-three new profiles have verified clubs and national links stay separate. Phone verification confirms complete Qatar XI and opening Abdelhak Assal's Al Khaldiya-linked profile.
- [ ] Resolve seven new profiles' current clubs and three ambiguous source identities — blocked by missing/conflicting current-club or identity evidence; retain verified national links and do not guess clubs. Audit: scripts/sofascore-cup-new-players.json.

- [x] Fix overflowing match-event layout and remove event-type/team captions under player names; checked real Iraq–Oman and Kuwait–Al Khaldiya pages at 402px with no horizontal overflow.

- [x] Replace blue penalty-winner text with neutral text; browser checked.
- [x] Import 15 verified fixtures into existing Khaleeji 27 plus Kuwait–Al Khaldiya in AFC Champions League Two, 539 existing-player lineup rows, verified events and 395 independent estimated ratings; preserve identities and alert settings. Audit: scripts/sofascore-cups-import.json.
- [ ] Complete remaining AFC source fixtures, unmatched lineup identities and detailed cup statistics — blocked by unavailable source responses or absent existing player identities; do not invent profiles or statistics.

- [x] Honor Crown Prince Cup hidden standings in club standings selectors and match pages; browser verified only AFC CL2 and Zain Premier League appear for Kuwait SC.

- [x] Fix cup penalty winners in lists/details, separate date/status from club names, respect hidden standings, and add ten verified kickoff times; phone browser verified Kazma–Khaitan 1–1 (1–3 pens), winner and 19:45 Kuwait kickoff. Four result-rule tests and six import tests pass.
- [ ] Add four remaining Emir Cup kickoff times (Kuwait–Nasr February 27; Salmiya–Tadamon November 25; Qadsia–Fahaheel and Arabi–Khaitan November 26) — blocked by no verifiable exact time in sources searched; retain date-only records, never infer.

- [x] Import the interrupted 2025/2026 Kuwait Emir Cup: 11 earlier results (two qualifiers, eight round-of-16 games and one quarter-final), three announced November quarter-finals, 18 existing clubs and 17 bracket ties through the final. Verified competition Matches/Knockout and opening a qualifier in the app; six tests pass, zero historical alerts queued. Semifinal stage scheduled December 4–5 without confirmed individual tie dates; final date, kickoff times, unresolved participants and player details not invented. Audit: scripts/emir-cup-import.json.

- [x] Import all 147 published Sportscorner 2026/2027 youth fixtures: U19 35 results + 7 date-only upcoming (rounds 1–6), U17 49 results + 56 upcoming (rounds 1–15). Reuse youth clubs, add Tadamon U17, match 15 participating U17 clubs to senior identities/badges, preserve 14 existing U19 fixture IDs, verify every imported field and computed standings, and check both league pages plus Kuwait U17 first-team link. No historical pushes queued; five import tests pass. Source league statistics provide no lineups, scorers, assists, discipline or ratings; these are not invented. Audit: scripts/sportscorner-youth-import.json.

- [x] Search Arabic/English YouTube highlights and add 24 verified links; preserve four existing links, all match data and full broadcasts. Kuwait–Tadamon highlight verified visibly on the match page; audit in scripts/zain-highlights-import.json.
- [x] Re-searched Kazma–Sulaibikhat, Salmiya–Jahra and Sahel–Nasr (round 6) in Arabic and English on October 25; no exact verified YouTube highlight found, so no links added. Arabi–Sulaibikhat round 3 is excluded because the user confirmed no stream.
- [ ] Add the three round-6 highlights when exact videos become available — blocked by no verified upload; never substitute older games or news reports.

- [x] Import 269 verified Sofascore statistic rows across 30 completed Zain Premier League matches in rounds 1–6 (123 updated, 146 added); all imported values verified, protected result/event/lineup/rating snapshots unchanged, five parser tests pass, and Kazma–Sulaibikhat Stats tab checked. Audit: scripts/sofascore-stats-import.json.
- [ ] Fill remaining Sofascore statistics gaps — Al Jahra–Al Arabi (round 2) and Kuwait–Sulaibikhat (round 5) pages expose no statistics; partial rows, three 0%/0% possession pairs and Salmiya–Jahra's invalid 194 corners were omitted; blocked by missing or invalid source values. Existing unrelated statistics remain unchanged.

- [x] Modernize multi-player event chooser and navigate single-player events directly; verified player destination with no dialog and portrait-based substitution chooser.
- [x] Label possible-lineup exports explicitly; verified rendered canvas label and preview.
- [x] Verify local match-time formatting across device timezones and connection timezone fallback: same fixture renders 17:30 Kuwait, 10:30 New York and 14:30 London. Simulated connection timezone updates Kuwait device display to 10:30; actual VPN exit detection remains blocked below.

- [x] Possible lineups seven days before kickoff, missing-player reasons, richer event player dialogs and substitutions; checked an upcoming Al Arabi lineup and real event dialog.
- [x] Preserve clock preference and adopt connection-location timezone when available; 24-hour preference verified after reopening Settings.
- [ ] Verify VPN exit-location timezone on hosted requests — local preview supplies no connection-location metadata and no VPN session is available; device timezone is the fallback.
- [x] Full standings GD and full-table image sharing; verified all 12 rows and all full columns in the generated image.
- [x] Batch social links from admin messages for club squads; real AI request correctly matched a supplied sample URL to Zaid Qunbar, without saving the sample.
- [x] Open all admin lineup/bench players for match rating and shirt-number editing; saved/reopened an unchanged bench kit number and verified its value.

- [x] Fix admin numbered-round sorting with shared comparator; authenticated phone verification shows rounds 1–11 in sequence.
- [x] Apply uploaded Zain Premier League rounds 7–11 photos to all 30 existing fixtures: correct sides/dates/stadiums, postpone Kuwait–Kazma with no invented date, and store rounds 9–11 as announced dates with Time TBD. Verified database counts, match detail, Home Upcoming and 15 tests.

- [x] Keep TBD/postponed rounds in sequence, fit status-only postponed labels, and replace the player-match assist emoji with a shared symbol; four round-order tests pass and verified the real competition/player pages at phone size.

- [x] Check source benches: mfsoccer rounds 1–6 contains starters and came-on substitutions only, not full match-day reserves.
- [x] Import 667 confirmed mfsoccer displayed reserves across all 64 completed round 1–6 match sides; preserve starters/substitutions, attribute calculated benches in notes, and verify Al Qadsia’s bench on-screen.
- [x] Add all eight resolved bench players’ 31 omitted round 1–6 appearances using the six user-confirmed aliases and the newly created Meshal Al Habs / Abdulaziz Salah profiles; verified 704 starters unchanged, 986 reserves/substitutes, no future lineups, and Vinicius on the round-3 match bench. Audit: scripts/mfsoccer-bench-resolved.json.
- [x] Correct four wrong-side historical coach assignments and fill confirmed round-2 Qadsia/Kuwait coaches; database checks pass and Kuwait round-3 coach verified on-screen.
- [ ] Complete historical coach verification — 11 completed matches still lack coach slots; blocked by missing dated match reports, and other preserved coach snapshots remain not independently verified.

- [x] Import verified Zain Premier League rounds 1–6: results, referee/channel, lineups, events, stats, and transparent calculated ratings; resolve player identities and use Al names without hyphens.
- [x] Verify imported totals and a real match in the app; source omits one incoming substitute, performance ratings, and detailed possession/shot statistics. Ratings are explicitly event-based estimates; upcoming fixtures retain no results.

- [x] Goal icon on saved result images: white version that shows on dark background (rebuilt from original artwork after a corrupted render).
- [x] Substitutes section redesign: came-on players from match events, minute on the left, shirt number badge top-left of the photo, green up-arrow badge, rating pill bottom-left, name in green with the replaced player's name in grey below; the lineup share card mirrors the same layout.
- [x] Compact on-screen substitutes with short incoming/outgoing and bench names, and original substitution artwork instead of a generic arrow.
- [x] Header: Voice icon next to the search bar; bottom tabs become Home/Competitions/News/Transfers/Tickets and the More sheet is removed.
- [x] Settings: Profile and Notifications collapse into tap-to-open headers; add Privacy policy and Support links; add collapsible ticket history.
- [x] Match times follow the device's timezone (e.g. US time when in the USA) instead of a fixed Kuwait time.
- [x] Settings: add 12/24-hour time format option
- [x] Privacy policy and Support pages: back button
- [x] Home Competitions view: Competitions grid, then Live, Today (calendar), Favorites (simple list with See all); tabbed Matches/Clubs/Competitions/Players layout lives on the Favorites page.
- [x] Bottom bar: Competitions tab replaced with Favorites (opens the Favorites page).
- [x] Compact Home tabs and original Live/competition styling; full Favorites category labels and a star navigation icon.
- [x] Replace Home Latest News with expandable countries that have upcoming matches, including World → Friendlies, in an original design.
- [x] Stretch Matches/Competitions across the available width with a small central gap and make Live clearly clickable.
- [x] Mark match dates in the calendar and add Upcoming beside Live, filtered from the selected date onward.
- [x] Lower the account-deletion confirmation and verify its placement.
- [x] Default Home to Upcoming; date selection switches to the picked day.
- [x] Add consistent watermark, website, and Instagram to every shared image and verify exports.

- [x] Fix the reported calendar lag/layout issue.

- [x] Home board: Filter pill opens a full-screen team search (Zain Premier League clubs + Kuwait national team first); picking a team shows its matches on the board with a clearable chip.
- [x] Fix: tapping the active bottom tab scrolls back to top (smooth); switching tabs starts the new page at the top.
- [x] Filter rework: full-screen, Zain Premier League clubs + Kuwait national team by default, search reveals the rest, picked club filters the home board.
- [x] Upcoming toggle: re-tapping Upcoming keeps upcoming matches; day/calendar views bring it back.
- [x] Filter sections: Club | Head to head tabs with + vs + slot picker and equal boxes; head-to-head notice kept.
- [x] Filter default browse shows grouped sections: Zain Premier League, Kuwait national teams, Zain First Division, Zain U19 League, Kuwait U17 League; search spans all teams.

## Oct 25 requests
- [x] League video thumbnail template in league settings; auto match thumbnail with logos + score
- [x] Add 5-2-3 formation
- [x] Fix player matches-played in competition statistics
- [x] Match media: type picker (custom, full match, live stream, ...) with auto title "Type | Home score Away"; label Zain PL media as Full Match
- [x] Possible lineups visible only to main admin
- [x] Confirmed-lineups notification + admin send button
- [x] Favorites: selecting a club shows its matches
- [x] Header scorers: group same player's minutes, max 3 rows then "+N goals"
- [x] Compact match events like reference; remove "Substitution: team" subtext
- [x] Share images footer: "Powered by Mansour Almail"
- [x] Transfer history redesign with tappable team links
- [ ] Refresh Khaleeji 27 Team of the Round for the latest completed round (user request, Oct 25)
