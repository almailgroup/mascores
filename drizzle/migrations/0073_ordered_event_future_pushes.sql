DO $migration$
DECLARE fn text; definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['match_event_push','match_event_scorer_push'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn AND p.pronargs=0;
    IF definition IS NULL OR position('mn := coalesce(NEW.minute::text' in definition)=0 THEN RAISE EXCEPTION 'Unexpected match notification definition: %', fn; END IF;
    definition := replace(definition, 'mn := coalesce(NEW.minute::text || ' || quote_literal('''') || ', ' || quote_literal('') || ');', $replacement$
    mn := coalesce(NEW.minute::text || '''', '');
    IF m.events_ordered THEN
      mn := '';
      SELECT (ordered.n::text || CASE WHEN ordered.n % 100 BETWEEN 11 AND 13 THEN 'th' WHEN ordered.n % 10=1 THEN 'st' WHEN ordered.n % 10=2 THEN 'nd' WHEN ordered.n % 10=3 THEN 'rd' ELSE 'th' END)
      INTO mn FROM (
        SELECT e.id, row_number() OVER (PARTITION BY CASE WHEN e.type IN ('goal','penalty_goal','penalty','own_goal') THEN 'goal' ELSE e.type END ORDER BY e.minute NULLS LAST,e.extra NULLS LAST,e.id) AS n
        FROM public.match_events e WHERE e.match_id=NEW.match_id
      ) ordered WHERE ordered.id=NEW.id;
      mn := coalesce(mn,'');
    END IF;
$replacement$);
    IF position('IF m.events_ordered THEN' in definition)=0 THEN RAISE EXCEPTION 'Notification patch did not apply: %',fn; END IF;
    EXECUTE definition;
  END LOOP;
END $migration$;