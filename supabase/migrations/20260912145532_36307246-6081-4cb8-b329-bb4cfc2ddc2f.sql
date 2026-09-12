ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS parent_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS age_group text;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS youth_competition_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS teams_parent_team_id_idx ON public.teams(parent_team_id);