CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- FIFA national team rankings (editable by admins)
CREATE TABLE public.fifa_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  previous_rank integer,
  season text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, season)
);
GRANT SELECT ON public.fifa_rankings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fifa_rankings TO authenticated;
GRANT ALL ON public.fifa_rankings TO service_role;
ALTER TABLE public.fifa_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read fifa rankings" ON public.fifa_rankings FOR SELECT USING (true);
CREATE POLICY "admin write fifa rankings" ON public.fifa_rankings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER fifa_rankings_updated BEFORE UPDATE ON public.fifa_rankings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permanent national kit per (national team, player)
CREATE TABLE public.national_player_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  shirt_number integer,
  photo_url text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, player_id)
);
GRANT SELECT ON public.national_player_kits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.national_player_kits TO authenticated;
GRANT ALL ON public.national_player_kits TO service_role;
ALTER TABLE public.national_player_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read national kits" ON public.national_player_kits FOR SELECT USING (true);
CREATE POLICY "admin write national kits" ON public.national_player_kits FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER national_player_kits_updated BEFORE UPDATE ON public.national_player_kits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.national_player_kits (team_id, player_id, shirt_number, photo_url, position)
SELECT team_id, player_id, shirt_number, photo_url, position
FROM public.national_team_players
WHERE shirt_number IS NOT NULL OR photo_url IS NOT NULL OR position IS NOT NULL
ON CONFLICT (team_id, player_id) DO NOTHING;

-- Competition scope / region
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS region text;

-- Typo-tolerant search indexes
CREATE INDEX IF NOT EXISTS teams_name_trgm ON public.teams USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_name_trgm ON public.players USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS competitions_name_trgm ON public.competitions USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS coaches_name_trgm ON public.coaches USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS venues_name_trgm ON public.venues USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.fuzzy_search(_q text, _limit integer DEFAULT 12)
RETURNS TABLE(kind text, id uuid, score real)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH q AS (SELECT lower(trim(coalesce(_q, ''))) AS t)
  SELECT * FROM (
    SELECT 'team'::text, t.id, greatest(similarity(lower(t.name), (SELECT t FROM q)), similarity(lower(coalesce(t.short_name, '')), (SELECT t FROM q))) AS score
    FROM public.teams t
    UNION ALL
    SELECT 'player'::text, p.id, similarity(lower(p.name), (SELECT t FROM q)) FROM public.players p
    UNION ALL
    SELECT 'competition'::text, c.id, similarity(lower(c.name), (SELECT t FROM q)) FROM public.competitions c
    UNION ALL
    SELECT 'coach'::text, ch.id, similarity(lower(ch.name), (SELECT t FROM q)) FROM public.coaches ch
    UNION ALL
    SELECT 'venue'::text, v.id, similarity(lower(v.name), (SELECT t FROM q)) FROM public.venues v
  ) s
  WHERE score > 0.2 AND length((SELECT t FROM q)) > 1
  ORDER BY score DESC
  LIMIT greatest(1, least(coalesce(_limit, 12), 60));
$$;
GRANT EXECUTE ON FUNCTION public.fuzzy_search(text, integer) TO anon, authenticated;