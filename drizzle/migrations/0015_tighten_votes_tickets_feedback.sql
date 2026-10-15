CREATE OR REPLACE FUNCTION public.match_prediction_tally(_match_id uuid)
RETURNS TABLE(choice text, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT v.choice, count(*) FROM public.match_prediction_votes v WHERE v.match_id = _match_id GROUP BY v.choice $$;
GRANT EXECUTE ON FUNCTION public.match_prediction_tally(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Signed-in users read prediction votes" ON public.match_prediction_votes;
DROP POLICY IF EXISTS "prediction votes public read" ON public.match_prediction_votes;
CREATE POLICY "prediction votes read own" ON public.match_prediction_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Ticket offers are viewable by everyone" ON public.ticket_offers;
CREATE POLICY "Approved ticket offers are viewable" ON public.ticket_offers FOR SELECT
USING ((is_active AND approval_status = 'approved') OR created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can send feedback" ON public.app_feedback;
CREATE POLICY "Send feedback as yourself" ON public.app_feedback FOR INSERT
WITH CHECK ((user_id IS NULL AND auth.uid() IS NULL) OR user_id = auth.uid());