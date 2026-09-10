-- Sensitive helpers: server-side only.
REVOKE EXECUTE ON FUNCTION public.grant_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unlock_allowed(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_standings(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_author_profiles(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_main_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_grant(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_suspended(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.voice_manage_participant(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.voice_end_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.voice_delete_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.voice_host_profiles(uuid[]) FROM anon;