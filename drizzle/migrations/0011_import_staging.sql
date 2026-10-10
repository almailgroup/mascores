CREATE TABLE public.import_staging (id text PRIMARY KEY, sql text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.import_staging TO service_role;
ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.import_staging IS 'Internal: staged data-import batches, service role only.';