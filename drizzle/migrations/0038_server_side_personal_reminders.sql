-- lovable-cron-fallback-reviewed: kick-off reminders fire at user-chosen minutes before a stored time; no delay-until provider exists, so a per-minute clock check is required for on-time delivery.
ALTER TABLE public.match_reminders ADD COLUMN IF NOT EXISTS sent_for timestamptz;

CREATE OR REPLACE FUNCTION public.queue_match_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE r record; n integer := 0; h teams; a teams; inserted boolean; bucket int; _bid uuid;
BEGIN
  FOR r IN
    SELECT m.id, m.kickoff_at, m.home_team_id, m.away_team_id,
      ceil(extract(epoch FROM m.kickoff_at - now()) / 60)::int AS mins
    FROM public.matches m
    WHERE m.status IN ('scheduled','live') AND m.kickoff_at > now() AND m.kickoff_at <= now() + interval '60 minutes'
  LOOP
    bucket := CASE WHEN r.mins <= 5 THEN 5 WHEN r.mins BETWEEN 27 AND 30 THEN 30 WHEN r.mins BETWEEN 57 AND 60 THEN 60 ELSE NULL END;
    CONTINUE WHEN bucket IS NULL;
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

  FOR r IN
    SELECT mr.id AS rid, mr.user_id, mr.minutes_before, m.id, m.kickoff_at, m.home_team_id, m.away_team_id,
      greatest(1, ceil(extract(epoch FROM m.kickoff_at - now()) / 60)::int) AS mins
    FROM public.match_reminders mr JOIN public.matches m ON m.id = mr.match_id
    WHERE m.kickoff_at IS NOT NULL AND NOT coalesce(m.alerts_muted, false)
      AND m.kickoff_at > now() - interval '2 minutes'
      AND now() >= m.kickoff_at - make_interval(mins => mr.minutes_before)
      AND mr.sent_for IS DISTINCT FROM m.kickoff_at
    FOR UPDATE OF mr SKIP LOCKED
  LOOP
    UPDATE public.match_reminders SET sent_for = r.kickoff_at WHERE id = r.rid;
    SELECT * INTO h FROM teams WHERE id = r.home_team_id;
    SELECT * INTO a FROM teams WHERE id = r.away_team_id;
    INSERT INTO public.push_broadcasts(kind, title_en, body_en, title_ar, body_ar, path, audience_type, audience_user_id)
    VALUES ('reminder',
      coalesce(h.name,'Home') || ' vs ' || coalesce(a.name,'Away'),
      CASE WHEN r.kickoff_at <= now() THEN 'Kick-off now' ELSE 'Kick-off in ' || r.mins || CASE WHEN r.mins = 1 THEN ' minute' ELSE ' minutes' END END,
      coalesce(h.name_ar,h.name,'') || ' ضد ' || coalesce(a.name_ar,a.name,''),
      CASE WHEN r.kickoff_at <= now() THEN 'انطلقت المباراة' ELSE 'تنطلق المباراة بعد ' || r.mins || ' دقيقة' END,
      '/matches/' || r.id, 'user', r.user_id)
    RETURNING id INTO _bid;
    BEGIN
      PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
        body := jsonb_build_object('broadcastId', _bid), headers := '{"Content-Type":"application/json"}'::jsonb);
    EXCEPTION WHEN others THEN NULL; END;
    n := n + 1;
  END LOOP;

  DELETE FROM public.push_reminders_sent WHERE kickoff_at < now() - interval '2 days';
  RETURN n;
END $function$;

SELECT cron.schedule('match-kickoff-reminders', '* * * * *', 'select public.queue_match_reminders();');

CREATE OR REPLACE FUNCTION public.match_event_scorer_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m matches; h teams; a teams; t teams; p players; te text; ta text; mn text; pe text; pa text;
BEGIN
  IF NEW.type NOT IN ('goal','penalty_goal','own_goal') THEN RETURN NEW; END IF;
  IF NEW.player_id IS NULL OR NEW.player_id IS NOT DISTINCT FROM OLD.player_id THEN RETURN NEW; END IF;
  SELECT * INTO m FROM matches WHERE id = NEW.match_id;
  IF m.status NOT IN ('live','1h','ht','2h','et') THEN RETURN NEW; END IF;
  SELECT * INTO h FROM teams WHERE id = m.home_team_id;
  SELECT * INTO a FROM teams WHERE id = m.away_team_id;
  SELECT * INTO t FROM teams WHERE id = NEW.team_id;
  SELECT * INTO p FROM players WHERE id = NEW.player_id;
  mn := coalesce(NEW.minute::text || '''', '');
  pe := coalesce(p.short_name, p.name, ''); pa := coalesce(p.name_ar, p.short_name, p.name, '');
  te := 'Goal scorer'; ta := 'مسجل الهدف';
  IF NEW.type='penalty_goal' THEN pe := pe || ' (pen)'; pa := pa || ' (ركلة جزاء)'; END IF;
  IF NEW.type='own_goal' THEN pe := pe || ' (OG)'; pa := pa || ' (هدف عكسي)'; END IF;
  PERFORM enqueue_match_push(m.id, 'scorer', NEW.team_id, NEW.player_id,
    te, trim(mn || ' ' || pe) || ' · ' || coalesce(h.name,'') || ' vs ' || coalesce(a.name,''),
    ta, trim(mn || ' ' || pa) || ' · ' || coalesce(h.name_ar,h.name,'') || ' ضد ' || coalesce(a.name_ar,a.name,''));
  RETURN NEW;
END $function$;