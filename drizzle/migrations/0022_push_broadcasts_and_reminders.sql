ALTER TABLE public.push_queue ADD COLUMN IF NOT EXISTS result jsonb;
GRANT ALL ON public.push_queue TO service_role;

CREATE TABLE IF NOT EXISTS public.push_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'custom',
  title_en text NOT NULL,
  body_en text NOT NULL DEFAULT '',
  title_ar text NOT NULL,
  body_ar text NOT NULL DEFAULT '',
  path text,
  audience_type text NOT NULL DEFAULT 'all',
  audience_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  result jsonb
);
GRANT ALL ON public.push_broadcasts TO service_role;
ALTER TABLE public.push_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_reminders_sent (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minutes integer NOT NULL,
  kickoff_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, minutes, kickoff_at)
);
GRANT ALL ON public.push_reminders_sent TO service_role;
ALTER TABLE public.push_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_send_push(_kind text, _title_en text, _body_en text, _title_ar text, _body_ar text, _path text, _audience_type text, _team_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE _id uuid;
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _kind NOT IN ('custom','news') THEN RAISE EXCEPTION 'Unknown notification kind'; END IF;
  IF _audience_type NOT IN ('all','team') THEN RAISE EXCEPTION 'Unknown audience'; END IF;
  IF _audience_type = 'team' AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id) THEN RAISE EXCEPTION 'Pick a club'; END IF;
  IF length(trim(coalesce(_title_en,''))) = 0 AND length(trim(coalesce(_title_ar,''))) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF length(coalesce(_title_en,'')) > 120 OR length(coalesce(_title_ar,'')) > 120 OR length(coalesce(_body_en,'')) > 400 OR length(coalesce(_body_ar,'')) > 400 THEN RAISE EXCEPTION 'Message too long'; END IF;
  IF _path IS NOT NULL AND _path !~ '^/[A-Za-z0-9/_.~%-]*$' THEN RAISE EXCEPTION 'Invalid link'; END IF;
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
REVOKE ALL ON FUNCTION public.admin_send_push(text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_push(text, text, text, text, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_recent_pushes(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, title_en text, body_en text, audience_type text, created_at timestamptz, sent_at timestamptz, result jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.is_main_admin(auth.uid()) OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT b.id, b.kind, b.title_en, b.body_en, b.audience_type, b.created_at, b.sent_at, b.result
    FROM public.push_broadcasts b ORDER BY b.created_at DESC LIMIT greatest(1, least(coalesce(_limit,20), 50));
END $$;
REVOKE ALL ON FUNCTION public.admin_recent_pushes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_pushes(integer) TO authenticated;

-- Automatic kick-off reminders 60, 30 and 5 minutes before, for followed matches and clubs.
CREATE OR REPLACE FUNCTION public.queue_match_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n integer := 0; h teams; a teams; inserted boolean; bucket int;
BEGIN
  FOR r IN
    SELECT m.id, m.kickoff_at, m.home_team_id, m.away_team_id,
      ceil(extract(epoch FROM m.kickoff_at - now()) / 60)::int AS mins
    FROM public.matches m
    WHERE m.status = 'scheduled' AND m.kickoff_at > now() AND m.kickoff_at <= now() + interval '60 minutes'
  LOOP
    bucket := CASE WHEN r.mins > 30 THEN 60 WHEN r.mins > 5 THEN 30 ELSE 5 END;
    inserted := false;
    INSERT INTO public.push_reminders_sent(match_id, minutes, kickoff_at) VALUES (r.id, bucket, r.kickoff_at)
      ON CONFLICT DO NOTHING RETURNING true INTO inserted;
    IF inserted THEN
      SELECT * INTO h FROM teams WHERE id = r.home_team_id;
      SELECT * INTO a FROM teams WHERE id = r.away_team_id;
      PERFORM public.enqueue_match_push(r.id, 'reminder', NULL, NULL,
        coalesce(h.name,'Home') || ' vs ' || coalesce(a.name,'Away'),
        'Kick-off in ' || r.mins || CASE WHEN r.mins = 1 THEN ' minute' ELSE ' minutes' END,
        coalesce(h.name_ar,h.name,'') || ' ضد ' || coalesce(a.name_ar,a.name,''),
        'تنطلق المباراة بعد ' || r.mins || ' دقيقة');
      n := n + 1;
    END IF;
  END LOOP;
  DELETE FROM public.push_reminders_sent WHERE kickoff_at < now() - interval '2 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.queue_match_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_match_push(uuid, text, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;