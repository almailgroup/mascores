-- Media files: only admins (and reporters for their own news covers) may read
-- them directly; everyone else sees images through the links issued at upload.
DROP POLICY IF EXISTS "read media" ON storage.objects;
CREATE POLICY "Admins and owners read media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['competition-logos','team-logos','player-photos','news-covers'])
  AND (
    public.is_admin(auth.uid())
    OR (bucket_id = 'news-covers' AND (storage.foldername(name))[1] = (auth.uid())::text)
  )
);

-- Match chat: signed-in members in good standing read the room; authors always see their own messages.
DROP POLICY IF EXISTS "authenticated users read chat" ON public.match_chat_messages;
CREATE POLICY "Members in good standing read chat"
ON public.match_chat_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id OR NOT public.is_suspended(auth.uid()));