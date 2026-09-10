CREATE TABLE public.admin_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('player','team','match','competition_team')),
  action text NOT NULL CHECK (action IN ('create','delete')),
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_change_requests TO authenticated;
GRANT ALL ON public.admin_change_requests TO service_role;

ALTER TABLE public.admin_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters see their own requests"
ON public.admin_change_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR public.is_main_admin(auth.uid()));

CREATE POLICY "Admins can ask for a change"
ON public.admin_change_requests FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid());

CREATE TRIGGER set_admin_change_requests_updated_at
BEFORE UPDATE ON public.admin_change_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX admin_change_requests_status_idx ON public.admin_change_requests (status, created_at DESC);