ALTER TABLE public.voice_recordings ADD COLUMN IF NOT EXISTS speaker_timeline jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.voice_recordings ALTER COLUMN is_public SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.voice_manage_participant(_room_id uuid, _user_id uuid, _action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.voice_rooms WHERE id = _room_id AND host_id = auth.uid() AND status = 'live') THEN
    RAISE EXCEPTION 'Only the live room host can manage participants';
  END IF;
  IF _action = 'promote' THEN
    -- Idempotent: a repeated tap never re-mutes someone who is already speaking.
    UPDATE public.voice_room_participants SET role = 'speaker', is_muted = true, hand_raised = false, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id AND role <> 'speaker';
  ELSIF _action = 'demote' THEN
    UPDATE public.voice_room_participants SET role = 'listener', is_muted = true, hand_raised = false, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id AND role <> 'listener';
  ELSIF _action = 'mute' THEN
    UPDATE public.voice_room_participants SET is_muted = true, updated_at = now()
    WHERE room_id = _room_id AND user_id = _user_id AND role = 'speaker';
  ELSIF _action = 'remove' THEN
    DELETE FROM public.voice_room_participants WHERE room_id = _room_id AND user_id = _user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported participant action';
  END IF;
END;
$function$;