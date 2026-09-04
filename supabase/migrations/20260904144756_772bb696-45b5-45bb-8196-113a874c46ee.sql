GRANT SELECT ON public.voice_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_rooms TO authenticated;
GRANT ALL ON public.voice_rooms TO service_role;

GRANT SELECT ON public.voice_room_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_room_participants TO authenticated;
GRANT ALL ON public.voice_room_participants TO service_role;

ALTER FUNCTION public.voice_end_room(uuid) SECURITY DEFINER;
ALTER FUNCTION public.voice_delete_room(uuid) SECURITY DEFINER;
ALTER FUNCTION public.voice_manage_participant(uuid, uuid, text) SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.voice_end_room(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.voice_delete_room(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.voice_manage_participant(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.voice_end_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.voice_delete_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.voice_manage_participant(uuid, uuid, text) TO authenticated;