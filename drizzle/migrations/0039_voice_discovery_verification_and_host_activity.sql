CREATE TABLE public.voice_user_badges (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, badge text NOT NULL CHECK (badge IN ('verified','golden')), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.voice_user_badges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.voice_user_badges TO authenticated;
GRANT ALL ON public.voice_user_badges TO service_role;
ALTER TABLE public.voice_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read displayed voice badges" ON public.voice_user_badges FOR SELECT USING (true);
CREATE POLICY "Owners manage voice badges" ON public.voice_user_badges FOR ALL TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));
CREATE FUNCTION public.voice_people(_q text DEFAULT '', _admin boolean DEFAULT false) RETURNS TABLE(id uuid,username text,display_name text,avatar_url text,followers bigint,badge text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF _admin AND NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'Owner access only'; END IF;
RETURN QUERY SELECT p.id,p.username,p.display_name,p.avatar_url,(SELECT count(*) FROM public.profile_follows f WHERE f.following_id=p.id),b.badge FROM public.profiles p LEFT JOIN public.voice_user_badges b ON b.user_id=p.id WHERE (p.is_public OR _admin) AND p.username IS NOT NULL AND (trim(coalesce(_q,''))='' OR p.username ILIKE '%'||left(trim(_q),100)||'%' OR p.display_name ILIKE '%'||left(trim(_q),100)||'%') ORDER BY 5 DESC,p.id LIMIT 40;
END; $$;
GRANT EXECUTE ON FUNCTION public.voice_people(text,boolean) TO anon,authenticated;
ALTER TABLE public.voice_rooms ADD COLUMN host_active_at timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION public.voice_host_activity(_room_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
UPDATE public.voice_rooms SET host_active_at=now() WHERE id=_room_id AND host_id=auth.uid() AND status='live';
END; $$;
REVOKE ALL ON FUNCTION public.voice_host_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voice_host_activity(uuid) TO authenticated;
CREATE FUNCTION public.voice_written_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
UPDATE public.voice_rooms SET host_active_at=now() WHERE id=NEW.room_id AND host_id=NEW.user_id AND status='live'; RETURN NEW; END; $$;
CREATE TRIGGER voice_message_host_activity AFTER INSERT ON public.voice_room_messages FOR EACH ROW EXECUTE FUNCTION public.voice_written_activity();
CREATE TRIGGER voice_reaction_host_activity AFTER INSERT ON public.voice_room_reactions FOR EACH ROW EXECUTE FUNCTION public.voice_written_activity();
CREATE FUNCTION public.end_inactive_voice_rooms() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
WITH ended AS (UPDATE public.voice_rooms SET status='ended',ended_at=now(),updated_at=now() WHERE status='live' AND host_active_at < now()-interval '10 minutes' RETURNING id) UPDATE public.voice_room_participants SET left_at=now(),updated_at=now() WHERE room_id IN (SELECT id FROM ended) AND left_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.end_inactive_voice_rooms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_inactive_voice_rooms() TO service_role;
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='match-kickoff-reminders'), command := 'select public.queue_match_reminders(); select public.end_inactive_voice_rooms();');