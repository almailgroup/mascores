DROP POLICY "Authors delete pending, admins delete all" ON public.news_submissions;
CREATE POLICY "Authors delete own submissions, admins delete all" ON public.news_submissions FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
DROP POLICY "Authors edit pending, admins edit all" ON public.news_submissions;
CREATE POLICY "Authors edit unapproved, admins edit all" ON public.news_submissions FOR UPDATE TO authenticated USING ((auth.uid() = author_id AND status IN ('pending', 'rejected')) OR public.is_admin(auth.uid())) WITH CHECK ((auth.uid() = author_id AND status = 'pending') OR public.is_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_submissions TO authenticated;