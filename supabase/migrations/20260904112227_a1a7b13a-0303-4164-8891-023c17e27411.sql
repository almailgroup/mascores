ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS away_coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS logo_url_dark text;
ALTER TABLE public.voice_rooms ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS from_club_logo_url text;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS to_club_logo_url text;

CREATE TABLE IF NOT EXISTS public.user_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  banned boolean NOT NULL DEFAULT false,
  suspended_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_suspensions TO authenticated;
GRANT ALL ON public.user_suspensions TO service_role;

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own suspension"
  ON public.user_suspensions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage suspensions insert"
  ON public.user_suspensions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage suspensions update"
  ON public.user_suspensions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage suspensions delete"
  ON public.user_suspensions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER user_suspensions_updated_at
  BEFORE UPDATE ON public.user_suspensions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_suspended(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_suspensions s
    WHERE s.user_id = _uid
      AND (s.banned OR (s.suspended_until IS NOT NULL AND s.suspended_until > now()))
  );
$$;