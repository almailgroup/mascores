ALTER TABLE public.voice_rooms ALTER COLUMN invite_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name_changed_at timestamptz;
CREATE OR REPLACE FUNCTION public.enforce_profile_name_cooldowns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF coalesce(OLD.username, '') <> '' AND OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - interval '10 days' THEN
      RAISE EXCEPTION 'USERNAME_COOLDOWN:%', (OLD.username_changed_at + interval '10 days');
    END IF;
    NEW.username_changed_at := now();
  END IF;
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    IF coalesce(OLD.display_name, '') <> '' AND OLD.display_name_changed_at IS NOT NULL AND OLD.display_name_changed_at > now() - interval '2 days' THEN
      RAISE EXCEPTION 'DISPLAY_COOLDOWN:%', (OLD.display_name_changed_at + interval '2 days');
    END IF;
    NEW.display_name_changed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_name_cooldowns ON public.profiles;
CREATE TRIGGER profiles_name_cooldowns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_name_cooldowns();