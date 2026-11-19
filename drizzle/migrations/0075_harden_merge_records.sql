REVOKE EXECUTE ON FUNCTION public.merge_records(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_records(text, uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.merge_records(text, uuid, uuid) IS 'Main-admin only. _kind is allow-listed to player/team; dynamic SQL uses only catalog-derived, quoted identifiers and bound UUID values.';