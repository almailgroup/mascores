ALTER TABLE public.ticket_offers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.ticket_offers
  ADD CONSTRAINT ticket_offers_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS ticket_offers_approval_status_idx ON public.ticket_offers (approval_status);