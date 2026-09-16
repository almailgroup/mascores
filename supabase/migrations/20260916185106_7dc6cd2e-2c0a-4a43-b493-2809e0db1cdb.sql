CREATE TABLE public.admin_competition_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, competition_id)
);

GRANT SELECT ON public.admin_competition_access TO authenticated;
GRANT ALL ON public.admin_competition_access TO service_role;

ALTER TABLE public.admin_competition_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See my own competition access" ON public.admin_competition_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_main_admin(auth.uid()));

CREATE INDEX admin_competition_access_user_idx ON public.admin_competition_access(user_id);