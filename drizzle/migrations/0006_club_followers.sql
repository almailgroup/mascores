ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS followers_override integer;
ALTER TABLE public.teams ADD CONSTRAINT teams_followers_override_nonnegative CHECK (followers_override IS NULL OR followers_override >= 0);
CREATE OR REPLACE FUNCTION public.club_follower_count(_team_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT count(*)::integer FROM public.profiles WHERE favorite_team_ids @> ARRAY[_team_id::text]; $$;
REVOKE ALL ON FUNCTION public.club_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_follower_count(uuid) TO anon, authenticated, service_role;