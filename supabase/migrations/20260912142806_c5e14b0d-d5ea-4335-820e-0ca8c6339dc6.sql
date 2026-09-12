ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS name_ar text;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS short_name_ar text;

ALTER TABLE public.app_feedback
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Users read own feedback" ON public.app_feedback;
CREATE POLICY "Users read own feedback"
  ON public.app_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update feedback" ON public.app_feedback;
CREATE POLICY "Admins update feedback"
  ON public.app_feedback FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Recordings are viewable by everyone" ON public.voice_recordings;
DROP POLICY IF EXISTS "Published replays are public" ON public.voice_recordings;
CREATE POLICY "Public or owned recordings are viewable"
  ON public.voice_recordings FOR SELECT
  USING (is_public = true OR host_id = auth.uid() OR public.is_admin(auth.uid()));