CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_read_own ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY blocks_remove_own ON public.user_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a))
$$;

CREATE OR REPLACE FUNCTION public.block_user(_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  INSERT INTO user_blocks(blocker_id, blocked_id) VALUES (auth.uid(), _target) ON CONFLICT DO NOTHING;
  DELETE FROM profile_follows WHERE (follower_id = auth.uid() AND following_id = _target) OR (follower_id = _target AND following_id = auth.uid());
  DELETE FROM follow_requests WHERE (requester_id = auth.uid() AND target_id = _target) OR (requester_id = _target AND target_id = auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.unblock_user(_target uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM user_blocks WHERE blocker_id = auth.uid() AND blocked_id = _target
$$;

CREATE OR REPLACE FUNCTION public.my_blocked_users() RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, blocked_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, b.created_at FROM user_blocks b JOIN profiles p ON p.id = b.blocked_id WHERE b.blocker_id = auth.uid() ORDER BY b.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.guard_blocked_social() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'profile_follows' AND public.is_blocked_between(NEW.follower_id, NEW.following_id) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  IF TG_TABLE_NAME = 'follow_requests' AND public.is_blocked_between(NEW.requester_id, NEW.target_id) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  IF TG_TABLE_NAME = 'recording_interactions' AND EXISTS (SELECT 1 FROM voice_recordings r WHERE r.id = NEW.recording_id AND public.is_blocked_between(r.host_id, NEW.user_id)) THEN RAISE EXCEPTION 'This account is unavailable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_blocked_follow BEFORE INSERT ON public.profile_follows FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_social();
CREATE TRIGGER guard_blocked_request BEFORE INSERT ON public.follow_requests FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_social();
CREATE TRIGGER guard_blocked_interaction BEFORE INSERT ON public.recording_interactions FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_social();

-- Turns every bell off for the signed-in account (used when phone notifications are switched off).
CREATE OR REPLACE FUNCTION public.mute_all_alerts() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO p FROM profiles WHERE id = auth.uid();
  UPDATE profiles SET match_notification_ids = '{}',
    notification_preferences = COALESCE(notification_preferences, '{}'::jsonb)
      || jsonb_build_object(
        'club_alert_overrides', COALESCE((SELECT jsonb_object_agg(k, false) FROM (SELECT jsonb_object_keys(COALESCE(p.notification_preferences->'club_alert_overrides','{}'::jsonb)) k UNION SELECT unnest(p.favorite_team_ids)::text) s), '{}'::jsonb),
        'player_alert_overrides', COALESCE((SELECT jsonb_object_agg(k, false) FROM (SELECT jsonb_object_keys(COALESCE(p.notification_preferences->'player_alert_overrides','{}'::jsonb)) k UNION SELECT unnest(p.favorite_player_ids)::text) s), '{}'::jsonb),
        'competition_alert_overrides', COALESCE((SELECT jsonb_object_agg(k, false) FROM jsonb_object_keys(COALESCE(p.notification_preferences->'competition_alert_overrides','{}'::jsonb)) k), '{}'::jsonb))
  WHERE id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.block_user(uuid), public.unblock_user(uuid), public.my_blocked_users(), public.mute_all_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid), public.unblock_user(uuid), public.my_blocked_users(), public.mute_all_alerts(), public.is_blocked_between(uuid, uuid) TO authenticated;