CREATE TABLE public.voice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  photo_url text,
  visibility text NOT NULL DEFAULT 'public',
  invite_code text NOT NULL DEFAULT upper(replace(gen_random_uuid()::text, '-', '')),
  status text NOT NULL DEFAULT 'live',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_rooms_visibility_check CHECK (visibility IN ('public','private')),
  CONSTRAINT voice_rooms_status_check CHECK (status IN ('live','ended'))
);
CREATE UNIQUE INDEX voice_rooms_invite_code_key ON public.voice_rooms (invite_code);
CREATE INDEX voice_rooms_live_idx ON public.voice_rooms (status, started_at DESC);

GRANT SELECT ON public.voice_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_rooms TO authenticated;
GRANT ALL ON public.voice_rooms TO service_role;
ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public voice rooms are viewable"
  ON public.voice_rooms FOR SELECT
  USING (visibility = 'public' OR host_id = auth.uid());
CREATE POLICY "Users create their own voice rooms"
  ON public.voice_rooms FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "Hosts update their own voice rooms"
  ON public.voice_rooms FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Hosts delete their own voice rooms"
  ON public.voice_rooms FOR DELETE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER voice_rooms_updated_at BEFORE UPDATE ON public.voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.voice_room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'listener',
  is_muted boolean NOT NULL DEFAULT true,
  hand_raised boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_room_participants_role_check CHECK (role IN ('host','speaker','listener')),
  CONSTRAINT voice_room_participants_unique UNIQUE (room_id, user_id)
);
CREATE INDEX voice_room_participants_room_idx ON public.voice_room_participants (room_id);

GRANT SELECT ON public.voice_room_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_room_participants TO authenticated;
GRANT ALL ON public.voice_room_participants TO service_role;
ALTER TABLE public.voice_room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants of visible rooms are viewable"
  ON public.voice_room_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.voice_rooms r WHERE r.id = room_id AND (r.visibility = 'public' OR r.host_id = auth.uid())) OR user_id = auth.uid());
CREATE POLICY "Users join rooms themselves"
  ON public.voice_room_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users or hosts update participants"
  ON public.voice_room_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.voice_rooms r WHERE r.id = room_id AND r.host_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.voice_rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));
CREATE POLICY "Users or hosts remove participants"
  ON public.voice_room_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.voice_rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));

CREATE TRIGGER voice_room_participants_updated_at BEFORE UPDATE ON public.voice_room_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.profile_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT profile_follows_not_self CHECK (follower_id <> following_id)
);
CREATE INDEX profile_follows_following_idx ON public.profile_follows (following_id);

GRANT SELECT, INSERT, DELETE ON public.profile_follows TO authenticated;
GRANT ALL ON public.profile_follows TO service_role;
ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by signed-in users"
  ON public.profile_follows FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Users create their own follows"
  ON public.profile_follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users remove their own follows"
  ON public.profile_follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

CREATE OR REPLACE FUNCTION public.voice_host_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text, followers bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.display_name, p.avatar_url,
         (SELECT count(*) FROM public.profile_follows f WHERE f.following_id = p.id) AS followers
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.voice_host_profiles(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.voice_room_by_code(_code text)
RETURNS TABLE(id uuid, host_id uuid, title text, description text, photo_url text, visibility text, status text, started_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id, r.host_id, r.title, r.description, r.photo_url, r.visibility, r.status, r.started_at
  FROM public.voice_rooms r
  WHERE upper(r.invite_code) = upper(trim(coalesce(_code, '')))
    AND length(trim(coalesce(_code, ''))) >= 8;
$$;

GRANT EXECUTE ON FUNCTION public.voice_room_by_code(text) TO anon, authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_participants;