CREATE OR REPLACE FUNCTION public.guard_voice_participant_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() = OLD.user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.voice_rooms r
       WHERE r.id = OLD.room_id AND r.host_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Only the room host can change speaking roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_voice_participant_role_change ON public.voice_room_participants;
CREATE TRIGGER guard_voice_participant_role_change
BEFORE UPDATE ON public.voice_room_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_voice_participant_role_change();

CREATE OR REPLACE FUNCTION public.voice_manage_participant(
  _room_id uuid,
  _user_id uuid,
  _action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_rooms
    WHERE id = _room_id AND host_id = auth.uid() AND status = 'live'
  ) THEN
    RAISE EXCEPTION 'Only the live room host can manage participants';
  END IF;

  IF _action = 'promote' THEN
    UPDATE public.voice_room_participants
    SET role = 'speaker', is_muted = true, hand_raised = false, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
  ELSIF _action = 'demote' THEN
    UPDATE public.voice_room_participants
    SET role = 'listener', is_muted = true, hand_raised = false, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id;
  ELSIF _action = 'mute' THEN
    UPDATE public.voice_room_participants
    SET is_muted = true, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id AND role = 'speaker';
  ELSIF _action = 'remove' THEN
    DELETE FROM public.voice_room_participants
    WHERE room_id = _room_id AND user_id = _user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported participant action';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.voice_end_room(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_rooms
    WHERE id = _room_id AND (host_id = auth.uid() OR public.is_admin(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Only the room host can end this room';
  END IF;

  UPDATE public.voice_rooms
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE id = _room_id;

  UPDATE public.voice_room_participants
  SET left_at = now(), updated_at = now()
  WHERE room_id = _room_id AND left_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.voice_delete_room(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_rooms
    WHERE id = _room_id AND (host_id = auth.uid() OR public.is_admin(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Only the room host can delete this room';
  END IF;

  DELETE FROM public.voice_rooms WHERE id = _room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.voice_manage_participant(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.voice_end_room(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.voice_delete_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voice_manage_participant(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.voice_end_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.voice_delete_room(uuid) TO authenticated;