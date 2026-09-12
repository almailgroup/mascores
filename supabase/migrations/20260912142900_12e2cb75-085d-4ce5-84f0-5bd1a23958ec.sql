DROP POLICY IF EXISTS "Room messages are readable" ON public.voice_room_messages;
CREATE POLICY "Room messages respect room visibility"
  ON public.voice_room_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_rooms r
      WHERE r.id = room_id
        AND (
          r.visibility = 'public'
          OR r.host_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.voice_room_participants p
            WHERE p.room_id = r.id AND p.user_id = auth.uid() AND p.left_at IS NULL
          )
        )
    )
  );

DROP POLICY IF EXISTS "Voice recordings readable by signed-in users" ON storage.objects;
CREATE POLICY "Voice recordings readable by owner or admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-recordings'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Signed-in users upload voice recordings" ON storage.objects;
CREATE POLICY "Users upload voice recordings to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );