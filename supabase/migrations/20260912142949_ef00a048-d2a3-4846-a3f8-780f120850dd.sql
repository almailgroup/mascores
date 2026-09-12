DROP POLICY IF EXISTS "prediction votes are readable" ON public.match_prediction_votes;
DROP POLICY IF EXISTS "Anyone can read prediction votes" ON public.match_prediction_votes;
DROP POLICY IF EXISTS "Public can read prediction votes" ON public.match_prediction_votes;
CREATE POLICY "Signed-in users read prediction votes"
  ON public.match_prediction_votes FOR SELECT TO authenticated
  USING (true);