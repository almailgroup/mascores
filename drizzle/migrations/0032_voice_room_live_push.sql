ALTER TABLE public.push_broadcasts ADD COLUMN IF NOT EXISTS audience_user_id uuid;

CREATE OR REPLACE FUNCTION public.voice_room_live_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE _name text; _id uuid;
BEGIN
  IF NEW.status <> 'live' OR NEW.visibility <> 'public' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'live' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_follows WHERE following_id = NEW.host_id) THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(trim(display_name),''), nullif(trim(username),''), 'Someone you follow') INTO _name
    FROM public.profiles WHERE id = NEW.host_id;
  _name := coalesce(_name, 'Someone you follow');
  INSERT INTO public.push_broadcasts(kind, title_en, body_en, title_ar, body_ar, path, audience_type, audience_user_id, created_by)
  VALUES ('voice',
    left(_name || ' is live now', 120),
    left('Join the voice room: ' || NEW.title, 400),
    left(_name || ' في بث مباشر الآن', 120),
    left('انضم إلى الغرفة الصوتية: ' || NEW.title, 400),
    '/voice/' || NEW.id, 'followers', NEW.host_id, NEW.host_id)
  RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('broadcastId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.voice_room_live_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS voice_room_live_push ON public.voice_rooms;
CREATE TRIGGER voice_room_live_push AFTER INSERT OR UPDATE OF status ON public.voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.voice_room_live_push();