CREATE OR REPLACE FUNCTION public.guard_blocked_social()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j jsonb := to_jsonb(NEW);
BEGIN
  IF TG_TABLE_NAME = 'profile_follows' THEN
    IF public.is_blocked_between((j->>'follower_id')::uuid, (j->>'following_id')::uuid) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  ELSIF TG_TABLE_NAME = 'follow_requests' THEN
    IF public.is_blocked_between((j->>'requester_id')::uuid, (j->>'target_id')::uuid) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  ELSIF TG_TABLE_NAME = 'recording_interactions' THEN
    IF EXISTS (SELECT 1 FROM voice_recordings r WHERE r.id = (j->>'recording_id')::uuid AND public.is_blocked_between(r.host_id, (j->>'user_id')::uuid)) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  END IF;
  RETURN NEW;
END $function$;