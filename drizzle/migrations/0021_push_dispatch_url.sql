CREATE OR REPLACE FUNCTION public.enqueue_match_push(_match uuid, _cat text, _team uuid, _player uuid, _te text, _be text, _ta text, _ba text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO push_queue(match_id, category, team_id, player_id, title_en, body_en, title_ar, body_ar)
  VALUES (_match, _cat, _team, _player, _te, _be, _ta, _ba) RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('queueId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_match_push(uuid,text,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;