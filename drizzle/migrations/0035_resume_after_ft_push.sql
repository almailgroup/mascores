CREATE OR REPLACE FUNCTION public.match_status_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h teams; a teams; te text; ta text; cat text := 'kickoff'; sc text; t int := coalesce(NEW.timer_elapsed_seconds,0); ot int := coalesce(OLD.timer_elapsed_seconds,0);
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND t = ot AND NEW.home_pen IS NOT DISTINCT FROM OLD.home_pen THEN RETURN NEW; END IF;
  IF NEW.status = 'live' AND OLD.home_pen IS NULL AND NEW.home_pen IS NOT NULL THEN te:='Penalty shootout'; ta:='ركلات الترجيح';
  ELSIF NEW.status = 'live' AND NEW.home_pen IS NULL AND OLD.status IN ('scheduled','postponed','interrupted') AND t < 2700 THEN te:='Kick-off'; ta:='انطلاق المباراة';
  ELSIF NEW.status = 'live' AND OLD.status = 'ht' AND ot < 5400 AND t >= 2700 AND t < 5400 THEN te:='Second half'; ta:='انطلاق الشوط الثاني';
  ELSIF NEW.status = 'live' AND t = 5400 AND ((ot <> 5400 AND OLD.status = 'live') OR OLD.status = 'ft') THEN te:='Extra time started'; ta:='انطلاق الوقت الإضافي';
  ELSIF NEW.status = 'live' AND OLD.status = 'ht' AND ot >= 5400 AND t >= 6300 THEN te:='Extra time second half'; ta:='الشوط الثاني من الوقت الإضافي';
  ELSIF NEW.status = 'ht' AND NEW.status IS DISTINCT FROM OLD.status AND t >= 5400 THEN te:='Extra time break'; ta:='استراحة الوقت الإضافي';
  ELSIF NEW.status = 'ht' AND NEW.status IS DISTINCT FROM OLD.status THEN te:='Half time'; ta:='نهاية الشوط الأول';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'ft' THEN cat:='final'; te:='Full time'; ta:='نهاية المباراة';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'aet' THEN cat:='final'; te:='Full time after extra time'; ta:='نهاية المباراة بعد الوقت الإضافي';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'pen' THEN cat:='final'; te:='Full time after penalties'; ta:='نهاية المباراة بركلات الترجيح';
  ELSIF NEW.status = 'live' AND OLD.status IN ('ft','aet','pen','interrupted','awarded') THEN te:='Match resumed'; ta:='استئناف المباراة';
  ELSE RETURN NEW; END IF;
  SELECT * INTO h FROM teams WHERE id = NEW.home_team_id;
  SELECT * INTO a FROM teams WHERE id = NEW.away_team_id;
  sc := coalesce(NEW.home_score,0) || ' - ' || coalesce(NEW.away_score,0);
  IF NEW.home_pen IS NOT NULL AND NEW.status = 'pen' THEN
    sc := sc || ' (' || NEW.home_pen || '-' || coalesce(NEW.away_pen,0) || ' pens)';
  END IF;
  PERFORM enqueue_match_push(NEW.id, cat, NULL, NULL,
    te, coalesce(h.name,'Home') || ' ' || sc || ' ' || coalesce(a.name,'Away'),
    ta, coalesce(h.name_ar,h.name,'') || ' ' || replace(sc,' pens)',' ترجيح)') || ' ' || coalesce(a.name_ar,a.name,''));
  RETURN NEW;
END $$;