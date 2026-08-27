# League stats, national teams and smarter search

## 1. Stats area in every competition
New **Stats** tab on the competition page, season-scoped, with two toggles:

- **Players** — average match rating in that competition/season, goals scored, assists, cards, matches played. Ranked lists (top rated, top scorers, top assists).
- **Teams** — average team rating (mean of its players' ratings), goals scored and conceded, average possession, shots and other tracked stats.

All figures are computed from existing data (match events, player ratings, match statistics) for matches in that competition and season — no manual entry.

## 2. National teams kept separate
- Admin **Teams** library gets two clearly separated sections: *Clubs* and *National teams*, instead of one mixed list.
- Same split when adding an existing team to a competition.

## 3. Call-ups limited to the right country
When picking players for a national team, only players of that country are offered (matched on nationality). A small "show all players" switch stays available for special cases (e.g. naturalised players).

## 4. Working group stages
Standings gets real group management: create several groups (Group A, B, C…), rename or delete a group, and move any team into a group from a dropdown on its row. Teams no longer all land in one table.

## 5. FIFA national team rankings
New editable rankings list (rank, points, movement) for national teams:
- Admin panel to add/edit/reorder entries.
- Shown on the national team page and as a "FIFA ranking" section reachable from national competitions.

## 6. National kits remembered
A player's national photo, shirt number and national position are saved permanently against that national team. Removing him from the squad no longer loses them — calling him up again restores his national kit automatically.

## 7. Competition scope: continental and regional
Competition form gains a **Scope** choice — National, Continental, Regional or International — plus a **Region** field (e.g. GCC, Middle East, Europe). Country stays optional for non-national competitions, and the competition list/pages show the scope instead of a missing country.

## 8. Country-aware team pickers
Inside a competition, "Add existing team" and "Title holder" only list teams from that competition's country (or region), with a toggle to widen the list when needed.

## 9. Typo-tolerant search
Search matches misspellings: "sluaibkhat" finds Sulaibikhat, "al aarbi" finds Al Arabi. Implemented with fuzzy text matching in the database (trigram similarity) across teams, players, competitions, coaches and stadiums, combined with the current exact/Arabic matching and ranked by closeness.

## Technical notes
- **Migration**: `fifa_rankings` table (team_id, rank, points, previous_rank, season, editable, RLS: public read / admin write); `national_player_kits` table (team_id + player_id unique, photo_url, shirt_number, position) as the permanent kit store; `competitions.scope` and `competitions.region` columns; enable `pg_trgm`, add trigram indexes on `teams.name`, `players.name`, `competitions.name`, `coaches.name`, `venues.name`, and a `search_all(_q text)` security-definer function returning ranked fuzzy matches.
- Stats are aggregated client-side with TanStack Query from `matches`, `match_events`, `player_ratings` and `match_stats`, scoped by competition + season; no new write paths.
- Standings groups reuse `standings_rows.group_label`; the panel adds group CRUD and a per-row group selector.
- Call-up flow writes to both `national_team_players` (active squad) and `national_player_kits` (persistent kit), reading the kit on call-up.
