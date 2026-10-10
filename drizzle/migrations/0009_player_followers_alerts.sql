CREATE OR REPLACE FUNCTION public.player_follower_count(_player_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT count(*)::integer FROM public.profiles WHERE favorite_player_ids @> ARRAY[_player_id::text]; $$;
GRANT EXECUTE ON FUNCTION public.player_follower_count(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_player_notification(_player_id uuid, _enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.players WHERE id=_player_id) THEN RAISE EXCEPTION 'Unknown player'; END IF;
 UPDATE public.profiles SET notification_preferences = COALESCE(notification_preferences,'{}'::jsonb) || jsonb_build_object('player_alert_overrides', COALESCE(notification_preferences->'player_alert_overrides','{}'::jsonb) || jsonb_build_object(_player_id::text,_enabled)) WHERE id=auth.uid() RETURNING notification_preferences->'player_alert_overrides' INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
 RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_player_notification(uuid, boolean) TO authenticated;