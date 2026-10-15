CREATE TABLE public.deleted_records (
  id bigserial PRIMARY KEY,
  batch_id bigint NOT NULL DEFAULT txid_current(),
  table_name text NOT NULL,
  record_id text,
  label text,
  data jsonb NOT NULL,
  deleted_by uuid DEFAULT auth.uid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
CREATE INDEX deleted_records_batch_idx ON public.deleted_records(batch_id);
CREATE INDEX deleted_records_deleted_at_idx ON public.deleted_records(deleted_at DESC);
GRANT SELECT ON public.deleted_records TO authenticated;
GRANT ALL ON public.deleted_records TO service_role;
GRANT USAGE ON SEQUENCE public.deleted_records_id_seq TO service_role;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Main admin reads recycle bin" ON public.deleted_records FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.archive_deleted_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d jsonb := to_jsonb(OLD);
BEGIN
  INSERT INTO public.deleted_records(table_name, record_id, label, data)
  VALUES (TG_TABLE_NAME, d->>'id', COALESCE(d->>'name', d->>'title', d->>'label', d->>'round', d->>'code'), d);
  RETURN OLD;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['competitions','teams','players','coaches','matches','match_events','match_lineups','match_stats','match_broadcasts','standings_rows','standings_position_labels','standing_labels','competition_teams','competition_awards','competition_knockout_ties','competition_title_history','team_titles','team_staff','team_season_players','national_team_players','national_player_kits','news_posts','news_submissions','transfers','venues','broadcast_channels','ticket_offers','tickets','media_items','fifa_rankings','player_ratings','ultras_posts','voice_recordings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS archive_on_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER archive_on_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_row()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.restore_deleted_batch(_batch_id bigint) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  FOR r IN SELECT * FROM public.deleted_records WHERE batch_id = _batch_id AND restored_at IS NULL ORDER BY id LOOP
    EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT DO NOTHING', r.table_name, r.table_name) USING r.data;
    UPDATE public.deleted_records SET restored_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.restore_deleted_batch(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_batch(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.archive_deleted_row() FROM PUBLIC, anon, authenticated;