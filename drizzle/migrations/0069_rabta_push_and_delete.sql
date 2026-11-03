DROP POLICY IF EXISTS "Authors and admins delete ultras posts" ON public.ultras_posts;
CREATE POLICY "Authors and admins delete ultras posts" ON public.ultras_posts FOR DELETE TO authenticated
USING (is_admin(auth.uid()) OR author_id = auth.uid() OR has_grant(auth.uid(), 'rabta', team_id));
DROP POLICY IF EXISTS "Authors and admins update ultras posts" ON public.ultras_posts;
CREATE POLICY "Authors and admins update ultras posts" ON public.ultras_posts FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR author_id = auth.uid() OR has_grant(auth.uid(), 'rabta', team_id));

CREATE OR REPLACE FUNCTION public.rabta_post_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE tt teams; _id uuid;
BEGIN
  IF NEW.status <> 'approved' OR (TG_OP = 'UPDATE' AND OLD.status = 'approved') THEN RETURN NEW; END IF;
  SELECT * INTO tt FROM teams WHERE id = NEW.team_id;
  INSERT INTO push_broadcasts(kind, title_en, body_en, title_ar, body_ar, path, audience_type, audience_team_id, created_by)
  VALUES ('news', left('Rabta · ' || coalesce(tt.name,'Club') || ': ' || NEW.title,120),
          left(coalesce(NEW.meeting_place || ' · ','') || coalesce(NEW.body,''),400),
          left('الرابطة · ' || coalesce(tt.name_ar, tt.name,'') || ': ' || NEW.title,120),
          left(coalesce(NEW.meeting_place || ' · ','') || coalesce(NEW.body,''),400),
          '/teams/' || NEW.team_id || '?tab=rabta', 'team', NEW.team_id, auth.uid())
  RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://ontmfbptthwipfzlywwh.supabase.co/functions/v1/send-match-alert',
      body := jsonb_build_object('broadcastId', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rabta_post_push ON public.ultras_posts;
CREATE TRIGGER rabta_post_push AFTER INSERT OR UPDATE OF status ON public.ultras_posts FOR EACH ROW EXECUTE FUNCTION public.rabta_post_push();