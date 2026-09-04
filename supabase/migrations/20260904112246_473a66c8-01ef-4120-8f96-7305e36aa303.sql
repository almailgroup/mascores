REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated, service_role;