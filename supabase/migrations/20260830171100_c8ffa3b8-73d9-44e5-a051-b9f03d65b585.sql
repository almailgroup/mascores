GRANT SELECT ON public.ticket_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_offers TO authenticated;
GRANT ALL ON public.ticket_offers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

GRANT SELECT ON public.voice_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_rooms TO authenticated;
GRANT ALL ON public.voice_rooms TO service_role;

GRANT SELECT ON public.voice_room_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_room_participants TO authenticated;
GRANT ALL ON public.voice_room_participants TO service_role;

GRANT SELECT, INSERT, DELETE ON public.profile_follows TO authenticated;
GRANT ALL ON public.profile_follows TO service_role;