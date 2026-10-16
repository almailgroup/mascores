CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid AND lower(u.email) IN ('mansouralmailscores@gmail.com','11061@dbs.edu.kw','hensi.g@elaunchinfotech.in'));
$function$;