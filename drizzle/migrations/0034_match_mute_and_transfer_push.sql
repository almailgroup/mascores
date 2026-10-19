ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS alerts_muted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enqueue_match_push(_match uuid, _cat text, _team uuid, _player uuid, _te text, _be text, _ta text, _ba text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM matches WHERE id = _match AND alerts_muted) THEN RETURN; END IF;
  INSERT INTO push_queue(match_id, category, team_id, player_id, title_en, body_en, title_ar, body_ar)
  VALUES (_match, _cat, _team, _player, _te, _be, _ta, _ba) RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('queueId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_match_push(uuid,text,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_transfer_push(_transfer_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE tr transfers; p players; c coaches; nm text; nma text; tt teams; _id uuid; te text; be text; ta text; ba text; pth text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM admin_grants g WHERE g.user_id = auth.uid())) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO tr FROM transfers WHERE id = _transfer_id;
  IF tr.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF tr.person_type = 'coach' THEN
    SELECT * INTO c FROM coaches WHERE id = tr.person_id; nm := c.name; nma := c.name; pth := '/coaches/' || tr.person_id;
  ELSE
    SELECT * INTO p FROM players WHERE id = tr.person_id; nm := coalesce(p.name,''); nma := coalesce(p.name_ar,p.name,''); pth := '/players/' || tr.person_id;
  END IF;
  SELECT * INTO tt FROM teams WHERE lower(name) = lower(tr.to_club) OR lower(name_ar) = lower(tr.to_club) LIMIT 1;
  IF coalesce(tr.to_club,'') = '' THEN
    te := 'Transfer news'; be := nm || ' has left ' || coalesce(tr.from_club,'his club');
    ta := 'خبر انتقال'; ba := nma || ' غادر ' || coalesce(tr.from_club,'ناديه');
  ELSE
    te := 'Official: ' || nm || ' joins ' || coalesce(tt.name, tr.to_club);
    be := nm || ' has joined ' || coalesce(tt.name, tr.to_club) || coalesce(' from ' || tr.from_club, '') || coalesce(' · ' || nullif(tr.fee,''), '');
    ta := 'رسميًا: ' || nma || ' ينضم إلى ' || coalesce(tt.name_ar, tt.name, tr.to_club);
    ba := nma || ' انضم إلى ' || coalesce(tt.name_ar, tt.name, tr.to_club) || coalesce(' قادمًا من ' || tr.from_club, '');
  END IF;
  INSERT INTO push_broadcasts(kind, title_en, body_en, title_ar, body_ar, path, audience_type, audience_user_id, audience_team_id, created_by)
  VALUES ('transfer', left(te,120), left(be,400), left(ta,120), left(ba,400), pth, 'player', tr.person_id, tt.id, auth.uid())
  RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('broadcastId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.send_transfer_push(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_transfer_push(uuid) TO authenticated;