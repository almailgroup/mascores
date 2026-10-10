CREATE OR REPLACE FUNCTION public.set_club_notification(_team_id uuid, _enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id=_team_id) THEN RAISE EXCEPTION 'Unknown club'; END IF;
 UPDATE public.profiles SET notification_preferences = COALESCE(notification_preferences,'{}'::jsonb) || jsonb_build_object('club_alert_overrides', COALESCE(notification_preferences->'club_alert_overrides','{}'::jsonb) || jsonb_build_object(_team_id::text,_enabled)) WHERE id=auth.uid() RETURNING notification_preferences->'club_alert_overrides' INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.set_club_notification(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_club_notification(uuid,boolean) TO authenticated,service_role;