-- Let admins upsert their own Arabic overrides for entity names (teams, players,
-- competitions, coaches, venues) directly into the shared translation cache.
CREATE POLICY "admin write translations" ON public.translations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin update translations" ON public.translations
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
