CREATE POLICY "Voice recordings readable by signed-in users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-recordings');
CREATE POLICY "Signed-in users upload voice recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-recordings');
CREATE POLICY "Owners delete voice recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-recordings' AND (owner = auth.uid() OR public.is_admin(auth.uid())));