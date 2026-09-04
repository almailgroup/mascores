ALTER TABLE public.voice_room_participants ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public voice rooms are viewable" ON public.voice_rooms;
CREATE POLICY "Public voice rooms are viewable"
  ON public.voice_rooms FOR SELECT
  USING (visibility = 'public' OR host_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.voice_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.voice_rooms(id) ON DELETE SET NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  title text NOT NULL,
  cover_url text,
  audio_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voice_recordings_recent_idx ON public.voice_recordings (created_at DESC);
CREATE INDEX voice_recordings_host_idx ON public.voice_recordings (host_id);

GRANT SELECT ON public.voice_recordings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_recordings TO authenticated;
GRANT ALL ON public.voice_recordings TO service_role;
ALTER TABLE public.voice_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recordings are viewable by everyone"
  ON public.voice_recordings FOR SELECT
  USING (true);
CREATE POLICY "Hosts save their own recordings"
  ON public.voice_recordings FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "Hosts update their own recordings"
  ON public.voice_recordings FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (host_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Hosts or admins delete recordings"
  ON public.voice_recordings FOR DELETE TO authenticated
  USING (host_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER voice_recordings_updated_at BEFORE UPDATE ON public.voice_recordings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();