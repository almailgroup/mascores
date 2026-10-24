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