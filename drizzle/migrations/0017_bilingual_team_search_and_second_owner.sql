CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid AND lower(u.email) IN ('mansouralmailscores@gmail.com','11061@dbs.edu.kw'));
$$;

INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = '11061@dbs.edu.kw'
ON CONFLICT DO NOTHING;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name_ar text;

UPDATE public.teams t SET name_ar = x.translated_text
FROM public.translations x
WHERE t.name_ar IS NULL AND x.locale = 'ar' AND x.source_text = t.name;

CREATE OR REPLACE FUNCTION public.norm_search(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    translate(lower(coalesce(_t,'')), 'أإآٱةىـًٌٍَُِّْ-''.', 'اااايه'),
    '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.search_teams(_q text, _limit integer DEFAULT 40)
RETURNS TABLE(id uuid, score real)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH q AS (SELECT public.norm_search(trim(_q)) AS t,
                    regexp_replace(public.norm_search(trim(_q)), '^ال', '') AS bare)
  SELECT t.id, greatest(
      similarity(public.norm_search(t.name), q.t),
      similarity(public.norm_search(coalesce(t.short_name,'')), q.t),
      similarity(public.norm_search(coalesce(t.name_ar,'')), q.t),
      CASE WHEN public.norm_search(t.name) LIKE '%'||q.t||'%'
             OR public.norm_search(coalesce(t.short_name,'')) LIKE '%'||q.t||'%'
             OR public.norm_search(coalesce(t.name_ar,'')) LIKE '%'||q.bare||'%'
             OR replace(public.norm_search(coalesce(t.name_ar,'')),' ','') LIKE '%'||replace(q.bare,' ','')||'%'
           THEN 1 ELSE 0 END)::real AS score
  FROM public.teams t, q
  WHERE length(q.t) > 1 AND coalesce(t.is_temporary,false) = false
  ORDER BY 2 DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.search_teams(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.norm_search(text) TO anon, authenticated;