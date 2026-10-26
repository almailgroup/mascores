-- Historical import integrity checks; run against the application's database.
SELECT
  count(*) = 36 AS six_rounds_have_all_fixtures,
  count(*) FILTER (WHERE status = 'ft') = 32 AS completed_results_imported,
  count(*) FILTER (WHERE status = 'scheduled') = 4 AS future_games_stay_scheduled,
  count(*) FILTER (WHERE status = 'scheduled' AND (home_score IS NOT NULL OR away_score IS NOT NULL)) = 0 AS no_fabricated_future_scores,
  count(*) FILTER (WHERE status = 'ft' AND referee IS NULL) = 0 AS completed_referees_present
FROM public.matches
WHERE competition_id = '792f150e-1c25-4f3c-878f-75536c7edd5b'
  AND season = '2026/2027' AND round_number BETWEEN 1 AND 6;

SELECT count(*) = 0 AS all_completed_lineups_have_22_starters
FROM (
  SELECT m.id
  FROM public.matches m
  LEFT JOIN public.match_lineups l ON l.match_id = m.id AND l.is_starting
  WHERE m.competition_id = '792f150e-1c25-4f3c-878f-75536c7edd5b'
    AND m.season = '2026/2027' AND m.round_number BETWEEN 1 AND 6 AND m.status = 'ft'
  GROUP BY m.id HAVING count(l.id) <> 22
) incomplete;

-- Match-specific coach snapshots corrected after home/away fixture reconciliation.
-- Missing historical coaches must not be filled from today's club assignments.
SELECT count(*) = 4 AND bool_and(
  m.home_coach_id = expected.home_coach_id::uuid
  AND m.away_coach_id = expected.away_coach_id::uuid
) AS reconciled_match_coaches_correct
FROM (VALUES
  ('118f7b6f-04ab-4128-8145-eb9d47a294fb', '3f62d234-64e2-413d-9d48-0cb5f045ae62', '131640ef-89b4-4e37-850d-0db3327c0971'),
  ('8f63bc16-b0f0-48d9-99c9-bb3c2097c90d', '6ca300a3-d8f9-4390-b3ff-776e2c7a41e8', 'ec005ebf-1ffb-41f6-a59c-9bd74f6b4692'),
  ('a18044df-376f-4c7e-8f7e-45885e169b47', '131640ef-89b4-4e37-850d-0db3327c0971', '6ca300a3-d8f9-4390-b3ff-776e2c7a41e8'),
  ('77f74163-fada-4663-9f4b-8ab2204fd5b5', 'cbf2ef48-029f-4ba3-aa7c-af1a6cf4314c', '22265e57-2c80-4728-b16d-77f0bb43cbc3')
) expected(match_id, home_coach_id, away_coach_id)
JOIN public.matches m ON m.id = expected.match_id::uuid;

-- Dated early-season reports confirm these round-2 coaches:
-- https://www.arabtimesonline.com/news/marhoon-stars-as-kuwait-club-snatches-late-win-over-qadsia/
-- https://www.ysscores.com/en/lineup/6018562/Qadsia-SC-vs-Kuwait-SC
SELECT count(*) = 1 AND bool_and(
  home_coach_id = '07f96baf-0828-49ef-a769-c893b1869da8'::uuid
  AND away_coach_id = '3f62d234-64e2-413d-9d48-0cb5f045ae62'::uuid
) AS round_two_qadsia_kuwait_coaches_correct
FROM public.matches WHERE id = 'c6b00c0b-1e3f-4f7c-b0ce-ecbd419e4437';

-- 667 initial + 31 user-confirmed source-calculated reserves; starters/subs unchanged.
SELECT count(*) FILTER (WHERE l.is_starting) = 704 AS original_starters_preserved,
       count(*) FILTER (WHERE NOT l.is_starting) = 986 AS reserves_and_substitutes_present,
       count(*) FILTER (WHERE m.status = 'scheduled') = 0 AS future_lineups_not_invented
FROM public.matches m JOIN public.match_lineups l ON l.match_id = m.id
WHERE m.competition_id = '792f150e-1c25-4f3c-878f-75536c7edd5b'
  AND m.season = '2026/2027' AND m.round_number BETWEEN 1 AND 6;

SELECT count(*) = 64 AS every_completed_match_side_has_reserves
FROM (
  SELECT l.match_id, l.team_id
  FROM public.match_lineups l JOIN public.matches m ON m.id = l.match_id
  WHERE m.competition_id = '792f150e-1c25-4f3c-878f-75536c7edd5b'
    AND m.season = '2026/2027' AND m.round_number BETWEEN 1 AND 6
    AND m.status = 'ft' AND NOT l.is_starting
  GROUP BY l.match_id, l.team_id
) sides;