# Roadmap

- [ ] Modernize multi-player event chooser and navigate single-player events directly.
- [ ] Label possible-lineup exports explicitly.
- [ ] Verify local match-time formatting across device timezones and connection timezone fallback; report actual VPN verification limits.

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
