ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS hidden_tabs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_knockout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followers_override integer;

CREATE TABLE IF NOT EXISTS public.competition_knockout_ties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  season text,
  round_label text NOT NULL DEFAULT 'Semi-finals',
  sort_order integer NOT NULL DEFAULT 0,
  home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  home_placeholder text,
  away_placeholder text,
  home_score integer,
  away_score integer,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.competition_knockout_ties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_knockout_ties TO authenticated;
GRANT ALL ON public.competition_knockout_ties TO service_role;

ALTER TABLE public.competition_knockout_ties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knockout ties are public" ON public.competition_knockout_ties FOR SELECT USING (true);
CREATE POLICY "Admins manage knockout ties" ON public.competition_knockout_ties FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS competition_knockout_ties_comp_idx ON public.competition_knockout_ties (competition_id, season, sort_order);

CREATE TRIGGER competition_knockout_ties_updated_at BEFORE UPDATE ON public.competition_knockout_ties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();