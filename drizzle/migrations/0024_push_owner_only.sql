CREATE OR REPLACE FUNCTION public.admin_send_push(_kind text, _title_en text, _body_en text, _title_ar text, _body_ar text, _path text, _audience_type text, _team_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
  IF _kind NOT IN ('custom','news') THEN RAISE EXCEPTION 'Unknown notification kind'; END IF;
  IF _audience_type NOT IN ('all','team') THEN RAISE EXCEPTION 'Unknown audience'; END IF;
  IF _audience_type = 'team' AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id) THEN RAISE EXCEPTION 'Pick a club'; END IF;
  IF length(trim(coalesce(_title_en,''))) = 0 AND length(trim(coalesce(_title_ar,''))) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF length(coalesce(_title_en,'')) > 120 OR length(coalesce(_title_ar,'')) > 120 OR length(coalesce(_body_en,'')) > 400 OR length(coalesce(_body_ar,'')) > 400 THEN RAISE EXCEPTION 'Message too long'; END IF;
  IF _path IS NOT NULL AND _path <> '' AND _path !~ '^/[A-Za-z0-9/_.~%-]*$' THEN RAISE EXCEPTION 'Invalid link'; END IF;
  INSERT INTO public.push_broadcasts(kind, title_en, body_en, title_ar, body_ar, path, audience_type, audience_team_id, created_by)
  VALUES (_kind,
    coalesce(nullif(trim(_title_en),''), trim(_title_ar)), coalesce(nullif(trim(_body_en),''), trim(coalesce(_body_ar,'')), ''),
    coalesce(nullif(trim(_title_ar),''), trim(_title_en)), coalesce(nullif(trim(_body_ar),''), trim(coalesce(_body_en,'')), ''),
    nullif(_path,''), _audience_type, CASE WHEN _audience_type = 'team' THEN _team_id END, auth.uid())
  RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('broadcastId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_recent_pushes(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, title_en text, body_en text, audience_type text, created_at timestamptz, sent_at timestamptz, result jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
  RETURN QUERY SELECT b.id, b.kind, b.title_en, b.body_en, b.audience_type, b.created_at, b.sent_at, b.result
    FROM public.push_broadcasts b ORDER BY b.created_at DESC LIMIT greatest(1, least(coalesce(_limit,20), 50));
END $$;