ALTER TABLE public.profile_contacts ADD COLUMN IF NOT EXISTS show_public boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.public_contacts(_user uuid)
RETURNS TABLE(phone text, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.phone, c.email FROM public.profile_contacts c
  WHERE c.user_id = _user AND c.show_public AND public.can_view_social_profile(_user)
$$;
GRANT EXECUTE ON FUNCTION public.public_contacts(uuid) TO anon, authenticated;