ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS completed_at timestamptz;
UPDATE public.matches SET completed_at = updated_at WHERE completed_at IS NULL AND status IN ('ft','aet','pen','awarded');
CREATE OR REPLACE FUNCTION public.track_match_completion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('ft','aet','pen','awarded') THEN
    IF TG_OP = 'INSERT' THEN NEW.completed_at := now();
    ELSIF OLD.status NOT IN ('ft','aet','pen','awarded') THEN NEW.completed_at := now();
    ELSE NEW.completed_at := OLD.completed_at; END IF;
  ELSE NEW.completed_at := NULL; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER track_round_match_completion BEFORE INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.track_match_completion();
CREATE TABLE public.competition_title_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  season text NOT NULL CHECK (length(trim(season)) BETWEEN 1 AND 30),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competition_id, season)
);
GRANT SELECT ON public.competition_title_history TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.competition_title_history TO authenticated;
GRANT ALL ON public.competition_title_history TO service_role;
ALTER TABLE public.competition_title_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY title_history_public_read ON public.competition_title_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY title_history_owner_write ON public.competition_title_history FOR ALL TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));
CREATE INDEX round_team_match_lookup ON public.matches (competition_id,season,round_number);
CREATE OR REPLACE FUNCTION public.competition_round_teams(_competition_id uuid, _season text DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH round_matches AS (
  SELECT m.*, COALESCE(m.season,c.season,'') AS season_key,
    CASE WHEN m.round_number IS NOT NULL THEN 'number:'||m.round_number::text ELSE 'label:'||trim(m.round) END AS round_key
  FROM public.matches m JOIN public.competitions c ON c.id=m.competition_id
  WHERE m.competition_id=_competition_id
    AND (_season IS NULL OR COALESCE(m.season,c.season,'')=_season)
    AND (m.round_number IS NOT NULL OR NULLIF(trim(m.round),'') IS NOT NULL)
), rounds AS (
  SELECT season_key,round_key,max(round_number) AS round_number,max(round) AS round_label,
    bool_and(status IN ('ft','aet','pen','awarded','cancelled')) AND count(*) FILTER (WHERE status IN ('ft','aet','pen','awarded'))>0 AS finished,
    max(completed_at) FILTER (WHERE status IN ('ft','aet','pen','awarded')) + interval '1 hour' AS available_at,
    bool_and(completed_at IS NOT NULL) FILTER (WHERE status IN ('ft','aet','pen','awarded')) AS timed
  FROM round_matches GROUP BY season_key,round_key
), candidates AS (
  SELECT DISTINCT ON (m.season_key,m.round_key,p.id)
    m.season_key,m.round_key,p.id AS player_id,p.name,p.photo_url,pr.rating,m.id AS match_id,
    t.id AS team_id,t.name AS team_name,t.logo_url AS team_logo,
    CASE
      WHEN upper(COALESCE(l.position_code,'')) IN ('GK','G') OR lower(p.position) LIKE '%goalkeeper%' THEN 'Goalkeeper'
      WHEN upper(COALESCE(l.position_code,'')) IN ('CB','LCB','RCB','LB','RB','LWB','RWB','D') OR lower(p.position) LIKE '%defender%' THEN 'Defender'
      WHEN upper(COALESCE(l.position_code,'')) IN ('CM','LCM','RCM','CDM','DM','CAM','AM','LM','RM','M') OR lower(p.position) LIKE '%midfielder%' THEN 'Midfielder'
      WHEN upper(COALESCE(l.position_code,'')) IN ('ST','CF','LW','RW','LF','RF','F') OR lower(p.position) LIKE '%forward%' OR lower(p.position) LIKE '%striker%' THEN 'Forward'
      ELSE NULL END AS position
  FROM round_matches m
  JOIN rounds r ON r.season_key=m.season_key AND r.round_key=m.round_key AND r.finished AND r.timed AND r.available_at<=now()
  JOIN public.player_ratings pr ON pr.match_id=m.id AND pr.rating>0 AND pr.rating<=10
  JOIN public.players p ON p.id=pr.player_id
  JOIN public.match_lineups l ON l.match_id=m.id AND l.player_id=p.id
  JOIN public.teams t ON t.id=l.team_id
  WHERE m.status IN ('ft','aet','pen','awarded') AND t.id IN (m.home_team_id,m.away_team_id)
  ORDER BY m.season_key,m.round_key,p.id,pr.rating DESC,m.kickoff_at DESC NULLS LAST,pr.id
), ranked AS (
  SELECT *,row_number() OVER (PARTITION BY season_key,round_key,position ORDER BY rating DESC,player_id) AS position_rank FROM candidates WHERE position IS NOT NULL
), selected AS (
  SELECT * FROM ranked WHERE (position='Goalkeeper' AND position_rank<=1) OR (position='Defender' AND position_rank<=4) OR (position='Midfielder' AND position_rank<=3) OR (position='Forward' AND position_rank<=3)
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('key',r.season_key||':'||r.round_key,'season',r.season_key,'round_number',r.round_number,'round_label',r.round_label,'available_at',r.available_at,'ready',COALESCE(r.finished AND r.timed AND r.available_at<=now(),false),'formation','4-3-3','players',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.player_id,'name',s.name,'photo_url',s.photo_url,'rating',s.rating,'position',s.position,'team_id',s.team_id,'team_name',s.team_name,'team_logo',s.team_logo,'match_id',s.match_id) ORDER BY s.position,s.position_rank) FROM selected s WHERE s.season_key=r.season_key AND s.round_key=r.round_key),'[]'::jsonb)) ORDER BY r.season_key DESC,r.round_number DESC NULLS LAST,r.round_key DESC),'[]'::jsonb) FROM rounds r;
$$;
REVOKE ALL ON FUNCTION public.competition_round_teams(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.competition_round_teams(uuid,text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.track_match_completion() FROM PUBLIC;