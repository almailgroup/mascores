CREATE TABLE public.voice_room_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('👏','❤️','😂','🔥','⚽')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.voice_room_reactions TO authenticated;
GRANT ALL ON public.voice_room_reactions TO service_role;
ALTER TABLE public.voice_room_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room reactions follow room access"
  ON public.voice_room_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_rooms r
      WHERE r.id = room_id AND (
        r.visibility = 'public' OR r.host_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.voice_room_participants p
          WHERE p.room_id = r.id AND p.user_id = auth.uid()
        )
      )
    )
  );
CREATE POLICY "Participants can react"
  ON public.voice_room_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.voice_room_participants p
      JOIN public.voice_rooms r ON r.id = p.room_id
      WHERE p.room_id = room_id AND p.user_id = auth.uid() AND p.left_at IS NULL AND r.status = 'live'
    )
  );
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_reactions;
CREATE INDEX voice_room_reactions_room_created_idx ON public.voice_room_reactions(room_id, created_at DESC);