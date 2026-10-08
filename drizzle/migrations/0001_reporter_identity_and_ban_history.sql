ALTER TABLE public.news_reporters ADD COLUMN civil_id_photo_path text;
CREATE TABLE public.user_ban_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, moderator_id uuid, action text NOT NULL DEFAULT 'restrict' CHECK (action IN ('restrict','lift')), banned boolean NOT NULL DEFAULT false, suspended_until timestamptz, reason text, strike integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_ban_history TO authenticated;
GRANT ALL ON public.user_ban_history TO service_role;
ALTER TABLE public.user_ban_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and admins read ban history" ON public.user_ban_history FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX user_ban_history_user_idx ON public.user_ban_history(user_id, created_at);
INSERT INTO public.user_ban_history(user_id, moderator_id, banned, suspended_until, reason, created_at) SELECT user_id, created_by, banned, suspended_until, reason, created_at FROM public.user_suspensions WHERE banned OR suspended_until IS NOT NULL;
CREATE OR REPLACE FUNCTION public.escalate_user_ban() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE previous_strikes integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF NOT NEW.banned AND (NEW.suspended_until IS NULL OR NEW.suspended_until <= now()) THEN RETURN NEW; END IF;
 SELECT count(*) INTO previous_strikes FROM public.user_ban_history WHERE user_id = NEW.user_id AND action='restrict';
 IF previous_strikes >= 2 THEN NEW.banned := true; NEW.suspended_until := NULL;
 ELSIF previous_strikes >= 1 AND NOT NEW.banned THEN NEW.suspended_until := greatest(NEW.suspended_until, now() + interval '7 days'); END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.escalate_user_ban() FROM PUBLIC;
CREATE TRIGGER escalate_user_ban BEFORE INSERT OR UPDATE ON public.user_suspensions FOR EACH ROW EXECUTE FUNCTION public.escalate_user_ban();
CREATE OR REPLACE FUNCTION public.record_user_ban_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE strikes integer;
BEGIN
 IF TG_OP='DELETE' THEN
  INSERT INTO public.user_ban_history(user_id,moderator_id,action,banned,suspended_until,reason,strike) VALUES(OLD.user_id,auth.uid(),'lift',OLD.banned,OLD.suspended_until,OLD.reason,(SELECT count(*) FROM public.user_ban_history WHERE user_id=OLD.user_id AND action='restrict'));
  RETURN OLD;
 END IF;
 IF NOT NEW.banned AND (NEW.suspended_until IS NULL OR NEW.suspended_until <= now()) THEN RETURN NEW; END IF;
 SELECT count(*)+1 INTO strikes FROM public.user_ban_history WHERE user_id=NEW.user_id AND action='restrict';
 INSERT INTO public.user_ban_history(user_id,moderator_id,banned,suspended_until,reason,strike) VALUES(NEW.user_id,NEW.created_by,NEW.banned,NEW.suspended_until,NEW.reason,strikes);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_user_ban_history() FROM PUBLIC;
CREATE TRIGGER record_user_ban_history AFTER INSERT OR UPDATE OR DELETE ON public.user_suspensions FOR EACH ROW EXECUTE FUNCTION public.record_user_ban_history();
CREATE POLICY "Applicants upload private identity" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='reporter-identity' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "Applicants and owner view identity" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='reporter-identity' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_main_admin(auth.uid())));
