CREATE TABLE public.team_season_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text NOT NULL,
  shirt_number integer,
  position text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, season, player_id)
);

GRANT SELECT ON public.team_season_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_season_players TO authenticated;
GRANT ALL ON public.team_season_players TO service_role;

ALTER TABLE public.team_season_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Season squads are public" ON public.team_season_players
  FOR SELECT USING (true);

CREATE POLICY "Admins manage season squads" ON public.team_season_players
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER team_season_players_updated_at
  BEFORE UPDATE ON public.team_season_players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX team_season_players_team_season_idx ON public.team_season_players (team_id, season);