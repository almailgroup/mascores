CREATE TABLE public.merge_dismissals (
  kind text NOT NULL,
  a_id uuid NOT NULL,
  b_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, a_id, b_id),
  CHECK (a_id < b_id)
);
GRANT SELECT, INSERT, DELETE ON public.merge_dismissals TO authenticated;
GRANT ALL ON public.merge_dismissals TO service_role;
ALTER TABLE public.merge_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read merge dismissals" ON public.merge_dismissals FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins add merge dismissals" ON public.merge_dismissals FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins remove merge dismissals" ON public.merge_dismissals FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));