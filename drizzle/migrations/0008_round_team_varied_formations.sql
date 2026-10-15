CREATE OR REPLACE FUNCTION public.competition_round_teams(_competition_id uuid, _season text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
WITH round_matches AS (
 SELECT m.*, COALESCE(m.season,c.season,'') AS season_key, CASE WHEN m.round_number IS NOT NULL THEN 'number:'||m.round_number::text ELSE 'label:'||trim(m.round) END AS round_key
 FROM public.matches m JOIN public.competitions c ON c.id=m.competition_id
 WHERE m.competition_id=_competition_id AND (_season IS NULL OR COALESCE(m.season,c.season,'')=_season) AND (m.round_number IS NOT NULL OR NULLIF(trim(m.round),'') IS NOT NULL)
), rounds AS (
 SELECT season_key,round_key,max(round_number) AS round_number,max(round) AS round_label,min(kickoff_at) AS starts_at,
 bool_or(kickoff_at<=now() OR status IN ('live','ht','ft','aet','pen','awarded')) AS started,
 bool_and(status IN ('ft','aet','pen','awarded','cancelled')) AND count(*) FILTER (WHERE status IN ('ft','aet','pen','awarded'))>0 AS finished,
 max(completed_at) FILTER (WHERE status IN ('ft','aet','pen','awarded')) + interval '1 hour' AS available_at,
 bool_and(completed_at IS NOT NULL) FILTER (WHERE status IN ('ft','aet','pen','awarded')) AS timed
 FROM round_matches GROUP BY season_key,round_key
), candidates AS (
 SELECT DISTINCT ON (m.season_key,m.round_key,p.id) m.season_key,m.round_key,p.id AS player_id,p.name,p.photo_url,pr.rating,m.id AS match_id,t.id AS team_id,t.name AS team_name,t.logo_url AS team_logo,
 CASE
 WHEN upper(COALESCE(l.position_code,'')) IN ('GK','G') THEN 'Goalkeeper'
 WHEN upper(COALESCE(l.position_code,'')) IN ('CB','LCB','RCB','LB','RB','LWB','RWB','D') THEN 'Defender'
 WHEN upper(COALESCE(l.position_code,'')) IN ('CM','LCM','RCM','CDM','DM','CAM','AM','LM','RM','M') THEN 'Midfielder'
 WHEN upper(COALESCE(l.position_code,'')) IN ('ST','CF','LW','RW','LF','RF','F') THEN 'Forward'
 WHEN lower(p.position) LIKE '%goalkeeper%' THEN 'Goalkeeper'
 WHEN lower(p.position) LIKE '%defender%' THEN 'Defender'
 WHEN lower(p.position) LIKE '%midfielder%' THEN 'Midfielder'
 WHEN lower(p.position) LIKE '%forward%' OR lower(p.position) LIKE '%striker%' THEN 'Forward' ELSE NULL END AS position
 FROM round_matches m JOIN rounds r ON r.season_key=m.season_key AND r.round_key=m.round_key AND r.finished AND r.timed AND r.available_at<=now()
 JOIN public.player_ratings pr ON pr.match_id=m.id AND pr.rating>0 AND pr.rating<=10 JOIN public.players p ON p.id=pr.player_id
 JOIN public.match_lineups l ON l.match_id=m.id AND l.player_id=p.id JOIN public.teams t ON t.id=l.team_id
 WHERE m.status IN ('ft','aet','pen','awarded') AND t.id IN (m.home_team_id,m.away_team_id)
 ORDER BY m.season_key,m.round_key,p.id,pr.rating DESC,m.kickoff_at DESC NULLS LAST,pr.id
), ranked AS (
 SELECT *,row_number() OVER (PARTITION BY season_key,round_key,position ORDER BY rating DESC,player_id) AS position_rank,
 avg(rating) OVER (PARTITION BY season_key,round_key,position) AS position_avg
 FROM candidates WHERE position IS NOT NULL
), formations(defenders,midfielders,forwards,pref) AS (
 VALUES (4,3,3,1),(4,4,2,2),(3,5,2,3),(4,5,1,4),(3,4,3,5),(5,3,2,6),(5,4,1,7)
), formation_scores AS (
 SELECT r.season_key,r.round_key,f.defenders,f.midfielders,f.forwards,f.pref,
 sum(p.rating - p.position_avg) AS standout_score, sum(p.rating) AS total_rating, count(p.player_id) AS player_count
 FROM rounds r CROSS JOIN formations f JOIN ranked p ON p.season_key=r.season_key AND p.round_key=r.round_key
 AND ((p.position='Goalkeeper' AND p.position_rank=1) OR (p.position='Defender' AND p.position_rank<=f.defenders) OR (p.position='Midfielder' AND p.position_rank<=f.midfielders) OR (p.position='Forward' AND p.position_rank<=f.forwards))
 GROUP BY r.season_key,r.round_key,f.defenders,f.midfielders,f.forwards,f.pref
), best_formation AS (
 SELECT DISTINCT ON (season_key,round_key) * FROM formation_scores WHERE player_count=11
 ORDER BY season_key,round_key,round(standout_score::numeric,2) DESC,total_rating DESC,pref
), selected AS (
 SELECT p.* FROM ranked p JOIN best_formation f USING(season_key,round_key)
 WHERE (position='Goalkeeper' AND position_rank=1) OR (position='Defender' AND position_rank<=f.defenders) OR (position='Midfielder' AND position_rank<=f.midfielders) OR (position='Forward' AND position_rank<=f.forwards)
), published AS (
 SELECT r.* FROM rounds r JOIN best_formation f USING(season_key,round_key)
), current_round AS (
 SELECT r.* FROM rounds r WHERE r.started AND NOT EXISTS(SELECT 1 FROM published p WHERE p.season_key=r.season_key AND p.round_key=r.round_key)
 ORDER BY r.season_key DESC,r.round_number ASC NULLS LAST,r.starts_at ASC NULLS LAST,r.round_key LIMIT 1
), visible_rounds AS (
 SELECT * FROM published UNION ALL SELECT * FROM current_round
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('key',r.season_key||':'||r.round_key,'season',r.season_key,'round_number',r.round_number,'round_label',r.round_label,'available_at',r.available_at,'ready',COALESCE(r.finished AND r.timed AND r.available_at<=now(),false),'formation',(SELECT f.defenders||'-'||f.midfielders||'-'||f.forwards FROM best_formation f WHERE f.season_key=r.season_key AND f.round_key=r.round_key),'players',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.player_id,'name',s.name,'photo_url',s.photo_url,'rating',s.rating,'position',s.position,'team_id',s.team_id,'team_name',s.team_name,'team_logo',s.team_logo,'match_id',s.match_id) ORDER BY s.position,s.position_rank) FROM selected s WHERE s.season_key=r.season_key AND s.round_key=r.round_key),'[]'::jsonb)) ORDER BY r.season_key DESC,r.round_number DESC NULLS LAST,r.round_key DESC),'[]'::jsonb) FROM visible_rounds r;
$function$;