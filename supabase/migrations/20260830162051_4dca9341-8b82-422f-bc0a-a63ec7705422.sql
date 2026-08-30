CREATE TABLE public.ticket_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'General admission',
  stand text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KWD',
  is_free boolean NOT NULL DEFAULT false,
  capacity integer,
  show_row boolean NOT NULL DEFAULT true,
  show_seat boolean NOT NULL DEFAULT true,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_offers TO authenticated;
GRANT ALL ON public.ticket_offers TO service_role;

ALTER TABLE public.ticket_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket offers are viewable by everyone"
  ON public.ticket_offers FOR SELECT USING (true);

CREATE POLICY "Admins manage ticket offers"
  ON public.ticket_offers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER ticket_offers_updated_at BEFORE UPDATE ON public.ticket_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid REFERENCES public.ticket_offers(id) ON DELETE SET NULL,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  holder_name text,
  row_label text,
  seat_label text,
  code text NOT NULL UNIQUE,
  price_paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KWD',
  status text NOT NULL DEFAULT 'valid',
  issued_with_admin_code boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX tickets_match_idx ON public.tickets(match_id);
CREATE INDEX tickets_user_idx ON public.tickets(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users create their own tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();