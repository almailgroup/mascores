CREATE OR REPLACE FUNCTION public.merge_records(_kind text, _keep uuid, _drop uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  UPDATE public.media_items SET owner_id = _keep WHERE owner_id = _drop;
  IF _kind = 'player' THEN
    UPDATE public.transfers SET person_id = _keep WHERE person_type = 'player' AND person_id = _drop;
    UPDATE public.profiles SET favorite_player_ids = array(SELECT DISTINCT unnest(array_replace(favorite_player_ids, _drop::text, _keep::text))) WHERE _drop::text = ANY(favorite_player_ids);
    UPDATE public.players k SET photo_url = coalesce(k.photo_url, d.photo_url), name_ar = coalesce(k.name_ar, d.name_ar), dob = coalesce(k.dob, d.dob),
      nationality = coalesce(k.nationality, d.nationality), nationality_code = coalesce(k.nationality_code, d.nationality_code), team_id = coalesce(k.team_id, d.team_id),
      position = coalesce(k.position, d.position), shirt_number = coalesce(k.shirt_number, d.shirt_number), height_cm = coalesce(k.height_cm, d.height_cm)
      FROM public.players d WHERE k.id = _keep AND d.id = _drop;
    DELETE FROM public.players WHERE id = _drop;
  ELSE
    UPDATE public.profiles SET favorite_team_ids = array(SELECT DISTINCT unnest(array_replace(favorite_team_ids, _drop::text, _keep::text))) WHERE _drop::text = ANY(favorite_team_ids);
    UPDATE public.teams k SET logo_url = coalesce(k.logo_url, d.logo_url), name_ar = coalesce(k.name_ar, d.name_ar), short_name = coalesce(k.short_name, d.short_name),
      country = coalesce(k.country, d.country), country_code = coalesce(k.country_code, d.country_code), competition_id = coalesce(k.competition_id, d.competition_id)
      FROM public.teams d WHERE k.id = _keep AND d.id = _drop;
    DELETE FROM public.teams WHERE id = _drop;
  END IF;
END $function$;

-- Arabic "skeleton": drop club words, the article and long vowels so spelling variants still match.
CREATE OR REPLACE FUNCTION public.ar_skeleton(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT translate(
    regexp_replace(regexp_replace(public.norm_search(coalesce(_t,'')), '(^|\s)(نادي|ناد|فريق|club|fc|sc)(\s|$)', ' ', 'g'), '(^|\s)ال', ' ', 'g'),
    'اويه ', '');
$$;

CREATE OR REPLACE FUNCTION public.search_teams(_q text, _limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, score real) LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT public.norm_search(trim(_q)) AS t,
                    regexp_replace(public.norm_search(trim(_q)), '^ال', '') AS bare,
                    public.ar_skeleton(trim(_q)) AS sk)
  SELECT t.id, greatest(
      similarity(public.norm_search(t.name), q.t),
      similarity(public.norm_search(coalesce(t.short_name,'')), q.t),
      similarity(public.norm_search(coalesce(t.name_ar,'')), q.t),
      word_similarity(q.t, public.norm_search(coalesce(t.name_ar,''))),
      CASE WHEN public.norm_search(t.name) LIKE '%'||q.t||'%'
             OR public.norm_search(coalesce(t.short_name,'')) LIKE '%'||q.t||'%'
             OR public.norm_search(coalesce(t.name_ar,'')) LIKE '%'||q.bare||'%'
             OR replace(public.norm_search(coalesce(t.name_ar,'')),' ','') LIKE '%'||replace(q.bare,' ','')||'%'
             OR (length(q.sk) >= 3 AND public.ar_skeleton(t.name_ar) LIKE '%'||q.sk||'%')
           THEN 1 ELSE 0 END)::real AS score
  FROM public.teams t, q
  WHERE length(q.t) > 1 AND coalesce(t.is_temporary,false) = false
  ORDER BY 2 DESC
  LIMIT _limit;
$function$;