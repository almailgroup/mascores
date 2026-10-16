CREATE OR REPLACE FUNCTION public.merge_records(_kind text, _keep uuid, _drop uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; tbl text;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
  IF _keep = _drop THEN RAISE EXCEPTION 'Pick two different records'; END IF;
  tbl := CASE _kind WHEN 'player' THEN 'players' WHEN 'team' THEN 'teams' ELSE NULL END;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Unknown kind'; END IF;
  FOR r IN
    SELECT c.conrelid::regclass AS rel, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = ('public.' || tbl)::regclass AND array_length(c.conkey,1) = 1
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.rel, r.col, r.col) USING _keep, _drop;
    EXCEPTION WHEN unique_violation THEN
      EXECUTE format('DELETE FROM %s WHERE %I = $1', r.rel, r.col) USING _drop;
    END;
  END LOOP;
  IF _kind = 'player' THEN
    UPDATE public.transfers SET person_id = _keep WHERE person_type = 'player' AND person_id = _drop;
    UPDATE public.media_items SET owner_id = _keep WHERE owner_id = _drop;
    UPDATE public.profiles SET favorite_player_ids = array(SELECT DISTINCT unnest(array_replace(favorite_player_ids, _drop, _keep))) WHERE _drop = ANY(favorite_player_ids);
    UPDATE public.players k SET photo_url = coalesce(k.photo_url, d.photo_url), name_ar = coalesce(k.name_ar, d.name_ar), dob = coalesce(k.dob, d.dob),
      nationality = coalesce(k.nationality, d.nationality), nationality_code = coalesce(k.nationality_code, d.nationality_code), team_id = coalesce(k.team_id, d.team_id),
      position = coalesce(k.position, d.position), shirt_number = coalesce(k.shirt_number, d.shirt_number), height_cm = coalesce(k.height_cm, d.height_cm)
      FROM public.players d WHERE k.id = _keep AND d.id = _drop;
    DELETE FROM public.players WHERE id = _drop;
  ELSE
    UPDATE public.media_items SET owner_id = _keep WHERE owner_id = _drop;
    UPDATE public.profiles SET favorite_team_ids = array(SELECT DISTINCT unnest(array_replace(favorite_team_ids, _drop, _keep))) WHERE _drop = ANY(favorite_team_ids);
    UPDATE public.teams k SET logo_url = coalesce(k.logo_url, d.logo_url), name_ar = coalesce(k.name_ar, d.name_ar), short_name = coalesce(k.short_name, d.short_name),
      country = coalesce(k.country, d.country), country_code = coalesce(k.country_code, d.country_code), competition_id = coalesce(k.competition_id, d.competition_id)
      FROM public.teams d WHERE k.id = _keep AND d.id = _drop;
    DELETE FROM public.teams WHERE id = _drop;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.merge_records(text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_records(text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_suggestions(_kind text, _limit integer DEFAULT 20)
RETURNS TABLE(a_id uuid, a_name text, b_id uuid, b_name text, score real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
  PERFORM set_config('pg_trgm.similarity_threshold', '0.55', true);
  IF _kind = 'player' THEN
    RETURN QUERY SELECT a.id, a.name, b.id, b.name, similarity(public.norm_search(a.name), public.norm_search(b.name))
      FROM public.players a JOIN public.players b ON a.id < b.id AND public.norm_search(a.name) % public.norm_search(b.name)
      WHERE NOT a.is_temporary AND NOT b.is_temporary
        AND (a.nationality_code IS NULL OR b.nationality_code IS NULL OR a.nationality_code = b.nationality_code)
      ORDER BY 5 DESC LIMIT _limit;
  ELSE
    RETURN QUERY SELECT a.id, a.name, b.id, b.name, similarity(public.norm_search(a.name), public.norm_search(b.name))
      FROM public.teams a JOIN public.teams b ON a.id < b.id AND public.norm_search(a.name) % public.norm_search(b.name)
      WHERE NOT a.is_temporary AND NOT b.is_temporary AND coalesce(a.age_group,'') = coalesce(b.age_group,'')
      ORDER BY 5 DESC LIMIT _limit;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.merge_suggestions(text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_suggestions(text, integer) TO authenticated;