CREATE OR REPLACE FUNCTION public.match_event_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m matches; h teams; a teams; t teams; p players; po players; cat text; te text; ta text; mn text; pe text; pa text; d text; oe text; oa text;
BEGIN
  IF NEW.type NOT IN ('goal','penalty_goal','own_goal','red','second_yellow','penalty_miss','yellow','substitution','injury_sub','var','note') THEN RETURN NEW; END IF;
  SELECT * INTO m FROM matches WHERE id = NEW.match_id;
  IF m.status NOT IN ('live','1h','ht','2h','et') THEN RETURN NEW; END IF;
  SELECT * INTO h FROM teams WHERE id = m.home_team_id;
  SELECT * INTO a FROM teams WHERE id = m.away_team_id;
  SELECT * INTO t FROM teams WHERE id = NEW.team_id;
  SELECT * INTO p FROM players WHERE id = NEW.player_id;
  SELECT * INTO po FROM players WHERE id = NEW.sub_out_player_id;
  mn := coalesce(NEW.minute::text || '''', '');
  pe := coalesce(p.short_name, p.name, ''); pa := coalesce(p.name_ar, p.short_name, p.name, '');
  d := nullif(trim(coalesce(NEW.description, '')), '');
  IF NEW.type IN ('goal','penalty_goal','own_goal') THEN
    cat := 'goals'; te := 'Goal'; ta := 'هدف';
    IF NEW.type='penalty_goal' THEN te := 'Penalty scored'; ta := 'هدف من ركلة جزاء';
      pe := pe || ' (pen)'; pa := pa || ' (ركلة جزاء)'; END IF;
    IF NEW.type='own_goal' THEN te := 'Own goal'; ta := 'هدف عكسي';
      pe := pe || ' (OG)'; pa := pa || ' (هدف عكسي)'; END IF;
    IF pe = '' OR pe = ' (pen)' OR pe = ' (OG)' THEN pe := coalesce(t.name, ''); END IF;
    IF pa = '' OR pa = ' (ركلة جزاء)' OR pa = ' (هدف عكسي)' THEN pa := coalesce(t.name_ar, t.name, ''); END IF;
  ELSIF NEW.type='penalty_miss' THEN cat:='goals'; te:='Penalty missed'; ta:='ركلة جزاء ضائعة';
  ELSIF NEW.type='yellow' THEN cat:='cards'; te:='Yellow card'; ta:='بطاقة صفراء';
  ELSIF NEW.type='second_yellow' THEN cat:='cards'; te:='Second yellow card'; ta:='بطاقة صفراء ثانية';
  ELSIF NEW.type IN ('substitution','injury_sub') THEN
    cat:='other';
    IF NEW.type='injury_sub' THEN te:='Injury substitution'; ta:='تبديل بسبب إصابة'; ELSE te:='Substitution'; ta:='تبديل'; END IF;
    oe := coalesce(po.short_name, po.name, ''); oa := coalesce(po.name_ar, po.short_name, po.name, '');
    IF pe <> '' AND oe <> '' THEN pe := pe || ' in, ' || oe || ' out'; pa := 'دخول ' || pa || '، خروج ' || oa;
    ELSIF pe <> '' THEN pe := pe || ' in'; pa := 'دخول ' || pa;
    ELSIF oe <> '' THEN pe := oe || ' out'; pa := 'خروج ' || oa;
    ELSE pe := coalesce(t.name, ''); pa := coalesce(t.name_ar, t.name, ''); END IF;
  ELSIF NEW.type='var' THEN
    cat := 'other';
    IF d = 'Goal VAR' THEN te:='Goal VAR'; ta:='مراجعة هدف (VAR)';
    ELSIF d = 'Penalty VAR' THEN te:='Penalty VAR'; ta:='مراجعة ركلة جزاء (VAR)';
    ELSIF d = 'Red card VAR' THEN te:='Red card VAR'; ta:='مراجعة بطاقة حمراء (VAR)';
    ELSE te:='VAR check'; ta:='مراجعة الفيديو (VAR)'; END IF;
    IF t.id IS NOT NULL THEN pe := '(' || t.name || ')'; pa := '(' || coalesce(t.name_ar, t.name) || ')';
    ELSIF d IS NOT NULL AND te = 'VAR check' THEN pe := d; pa := d; ELSE pe := ''; pa := ''; END IF;
  ELSIF NEW.type='note' THEN
    cat := 'other'; te:='Match update'; ta:='تحديث المباراة';
    IF d IS NOT NULL THEN pe := d; pa := d;
    ELSIF pe = '' THEN pe := coalesce(t.name, ''); pa := coalesce(t.name_ar, t.name, ''); END IF;
  ELSE cat:='cards'; te:='Red card'; ta:='بطاقة حمراء';
  END IF;
  PERFORM enqueue_match_push(m.id, cat, NEW.team_id, NEW.player_id,
    te, trim(mn || ' ' || pe) || ' · ' || coalesce(h.name,'') || ' vs ' || coalesce(a.name,''),
    ta, trim(mn || ' ' || pa) || ' · ' || coalesce(h.name_ar,h.name,'') || ' ضد ' || coalesce(a.name_ar,a.name,''));
  RETURN NEW;
END $$;