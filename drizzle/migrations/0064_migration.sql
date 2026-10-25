CREATE OR REPLACE FUNCTION public.competition_season_team(_competition_id uuid, _season text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
WITH ms AS (
 SELECT m.* FROM public.matches m JOIN public.competitions c ON c.id=m.competition_id
 WHERE m.competition_id=_competition_id AND (_season IS NULL OR COALESCE(m.season,c.season,'')=_season)
 AND m.status IN ('ft','aet','pen','awarded') AND m.completed_at IS NOT NULL AND m.completed_at + interval '1 hour' <= now()
), rated AS (
 SELECT p.id AS player_id,p.name,p.photo_url,pr.rating,m.id AS match_id,m.kickoff_at,t.id AS team_id,t.name AS team_name,t.logo_url AS team_logo,
 CASE
  WHEN upper(COALESCE(l.position_code,'')) IN ('GK','G') THEN 'Goalkeeper'
  WHEN upper(COALESCE(l.position_code,'')) IN ('CB','LCB','RCB','LB','RB','LWB','RWB','D') THEN 'Defender'
  WHEN upper(COALESCE(l.position_code,'')) IN ('CM','LCM','RCM','CDM','DM','CAM','AM','LM','RM','M') THEN 'Midfielder'
  WHEN upper(COALESCE(l.position_code,'')) IN ('ST','CF','LW','RW','LF','RF','F') THEN 'Forward'
  WHEN lower(p.position) LIKE '%goalkeeper%' THEN 'Goalkeeper'
  WHEN lower(p.position) LIKE '%defender%' THEN 'Defender'
  WHEN lower(p.position) LIKE '%midfielder%' THEN 'Midfielder'
  WHEN lower(p.position) LIKE '%forward%' OR lower(p.position) LIKE '%striker%' THEN 'Forward' END AS position
 FROM ms m JOIN public.player_ratings pr ON pr.match_id=m.id AND pr.rating>0 AND pr.rating<=10
 JOIN public.players p ON p.id=pr.player_id
 JOIN public.match_lineups l ON l.match_id=m.id AND l.player_id=p.id
 JOIN public.teams t ON t.id=l.team_id AND t.id IN (m.home_team_id,m.away_team_id)
), agg AS (
 SELECT player_id, avg(rating) AS rating, count(DISTINCT match_id) AS apps,
  (array_agg(position ORDER BY kickoff_at DESC NULLS LAST) FILTER (WHERE position IS NOT NULL))[1] AS position,
  max(name) AS name, max(photo_url) AS photo_url,
  (array_agg(team_id ORDER BY kickoff_at DESC NULLS LAST))[1] AS team_id,
  (array_agg(team_name ORDER BY kickoff_at DESC NULLS LAST))[1] AS team_name,
  (array_agg(team_logo ORDER BY kickoff_at DESC NULLS LAST))[1] AS team_logo
 FROM rated GROUP BY player_id
), threshold AS (
 SELECT GREATEST(1, ceil(COALESCE(max(apps),0)/2.0)) AS min_apps FROM agg
), ranked AS (
 SELECT a.*, row_number() OVER (PARTITION BY position ORDER BY rating DESC, apps DESC, player_id) AS position_rank,
 avg(rating) OVER (PARTITION BY position) AS position_avg
 FROM agg a, threshold th WHERE a.position IS NOT NULL AND a.apps >= th.min_apps
), formations(defenders,midfielders,forwards,pref) AS (
 VALUES (4,3,3,1),(4,4,2,2),(3,5,2,3),(4,5,1,4),(3,4,3,5),(5,3,2,6),(5,4,1,7)
), fs AS (
 SELECT f.*, sum(p.rating-p.position_avg) AS standout, sum(p.rating) AS total, count(*) AS n
 FROM formations f JOIN ranked p ON (p.position='Goalkeeper' AND p.position_rank=1) OR (p.position='Defender' AND p.position_rank<=f.defenders) OR (p.position='Midfielder' AND p.position_rank<=f.midfielders) OR (p.position='Forward' AND p.position_rank<=f.forwards)
 GROUP BY f.defenders,f.midfielders,f.forwards,f.pref
), best AS (
 SELECT * FROM fs WHERE n=11 ORDER BY round(standout::numeric,2) DESC, total DESC, pref LIMIT 1
)
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM best) THEN NULL ELSE jsonb_build_object(
 'key','competition','round_number',NULL,'round_label','Team of the Competition','available_at',NULL,'ready',true,
 'formation',(SELECT defenders||'-'||midfielders||'-'||forwards FROM best),
 'players',(SELECT jsonb_agg(jsonb_build_object('id',p.player_id,'name',p.name,'photo_url',p.photo_url,'rating',round(p.rating::numeric,2),'position',p.position,'team_id',p.team_id,'team_name',p.team_name,'team_logo',p.team_logo,'apps',p.apps) ORDER BY p.position,p.position_rank)
   FROM ranked p, best f WHERE (p.position='Goalkeeper' AND p.position_rank=1) OR (p.position='Defender' AND p.position_rank<=f.defenders) OR (p.position='Midfielder' AND p.position_rank<=f.midfielders) OR (p.position='Forward' AND p.position_rank<=f.forwards))
) END;
$function$;
GRANT EXECUTE ON FUNCTION public.competition_season_team(uuid,text) TO anon, authenticated;