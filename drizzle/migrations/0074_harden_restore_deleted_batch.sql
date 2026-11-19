CREATE OR REPLACE FUNCTION public.restore_deleted_batch(_batch_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0; _rel regclass;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_main_admin(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  FOR r IN SELECT * FROM public.deleted_records WHERE batch_id = _batch_id AND restored_at IS NULL ORDER BY id LOOP
    SELECT c.oid::regclass INTO _rel
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relname = r.table_name
       AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                    WHERE t.tgrelid = c.oid AND NOT t.tgisinternal AND p.proname = 'archive_deleted_row');
    IF _rel IS NULL THEN RAISE EXCEPTION 'table not restorable'; END IF;
    EXECUTE format('INSERT INTO %s SELECT * FROM jsonb_populate_record(NULL::%s, $1) ON CONFLICT DO NOTHING', _rel, _rel) USING r.data;
    UPDATE public.deleted_records SET restored_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_batch(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_batch(bigint) TO authenticated;