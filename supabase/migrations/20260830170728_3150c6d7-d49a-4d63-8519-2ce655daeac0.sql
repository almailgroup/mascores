ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS holder_email text,
  ADD COLUMN IF NOT EXISTS holder_phone text;

CREATE INDEX IF NOT EXISTS tickets_user_idx ON public.tickets (user_id);