CREATE OR REPLACE FUNCTION public.register_push_device(_token text, _locale text DEFAULT 'en') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
 IF _token IS NULL OR _token !~ '^[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid device token' USING ERRCODE = '22023'; END IF;
 INSERT INTO public.device_tokens(user_id,token,platform,locale,updated_at) VALUES (_uid,_token,'ios',CASE WHEN _locale='ar' THEN 'ar' ELSE 'en' END,now())
 ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,locale=EXCLUDED.locale,updated_at=EXCLUDED.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.register_push_device(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.remove_profile_push_devices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 DELETE FROM public.device_tokens WHERE user_id=OLD.id;
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_profile_push_devices() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER remove_profile_push_devices BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.remove_profile_push_devices();