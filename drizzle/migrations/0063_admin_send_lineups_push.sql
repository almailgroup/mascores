CREATE OR REPLACE FUNCTION public.admin_send_lineups_push(_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h text; a text;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
  SELECT th.name, ta.name INTO h, a FROM matches m LEFT JOIN teams th ON th.id=m.home_team_id LEFT JOIN teams ta ON ta.id=m.away_team_id WHERE m.id=_match;
  PERFORM public.enqueue_match_push(_match, 'other', NULL, NULL,
    'Confirmed lineups', coalesce(h,'') || ' vs ' || coalesce(a,'') || ' — the starting elevens are out.',
    'التشكيلة الرسمية', 'تم إعلان التشكيلة الأساسية لمباراة ' || coalesce(h,'') || ' و ' || coalesce(a,''));
END $$;
REVOKE ALL ON FUNCTION public.admin_send_lineups_push(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_lineups_push(uuid) TO authenticated;