ALTER TABLE public.ticket_offers
  ADD COLUMN IF NOT EXISTS event_home text,
  ADD COLUMN IF NOT EXISTS event_away text,
  ADD COLUMN IF NOT EXISTS event_competition text,
  ADD COLUMN IF NOT EXISTS event_venue text,
  ADD COLUMN IF NOT EXISTS event_kickoff_at timestamptz;

ALTER TABLE public.ticket_offers ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.ticket_offers DROP CONSTRAINT IF EXISTS ticket_offers_match_id_fkey;
ALTER TABLE public.ticket_offers
  ADD CONSTRAINT ticket_offers_match_id_fkey FOREIGN KEY (match_id)
  REFERENCES public.matches(id) ON DELETE SET NULL;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_match_id_fkey;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_match_id_fkey FOREIGN KEY (match_id)
  REFERENCES public.matches(id) ON DELETE SET NULL;