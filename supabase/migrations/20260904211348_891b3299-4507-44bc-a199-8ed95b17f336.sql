CREATE OR REPLACE FUNCTION public.competition_follower_count(_competition_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.profiles
  WHERE favorite_competition_ids @> ARRAY[_competition_id::text];
$$;

GRANT EXECUTE ON FUNCTION public.competition_follower_count(uuid) TO anon, authenticated;