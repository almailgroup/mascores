ALTER FUNCTION public.guard_voice_participant_role_change() SECURITY INVOKER;
ALTER FUNCTION public.voice_manage_participant(uuid, uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.voice_end_room(uuid) SECURITY INVOKER;
ALTER FUNCTION public.voice_delete_room(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.guard_voice_participant_role_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_voice_participant_role_change() TO service_role;