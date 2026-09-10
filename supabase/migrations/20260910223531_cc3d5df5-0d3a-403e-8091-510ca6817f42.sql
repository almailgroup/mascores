ALTER TABLE public.voice_room_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_messages;