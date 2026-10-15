CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  category text NOT NULL,
  team_id uuid,
  player_id uuid,
  title_en text NOT NULL, body_en text NOT NULL,
  title_ar text NOT NULL, body_ar text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.push_queue TO service_role;
ALTER TABLE public.push_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_match_push(_match uuid, _cat text, _team uuid, _player uuid, _te text, _be text, _ta text, _ba text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO push_queue(match_id, category, team_id, player_id, title_en, body_en, title_ar, body_ar)
  VALUES (_match, _cat, _team, _player, _te, _be, _ta, _ba) RETURNING id INTO _id;
  BEGIN
    PERFORM net.http_post(url := 'https://mascores.live/api/public/push-dispatch',
      body := jsonb_build_object('id', _id), headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN others THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_match_push(uuid,text,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_status_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h teams; a teams; te text; ta text; cat text; sc text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO h FROM teams WHERE id = NEW.home_team_id;
  SELECT * INTO a FROM teams WHERE id = NEW.away_team_id;
  sc := coalesce(NEW.home_score,0) || ' - ' || coalesce(NEW.away_score,0);
  IF NEW.status IN ('live','1h') THEN cat:='kickoff'; te:='Kick-off'; ta:='انطلاق المباراة';
  ELSIF NEW.status = 'ht' THEN cat:='kickoff'; te:='Half time'; ta:='نهاية الشوط الأول';
  ELSIF NEW.status = '2h' THEN cat:='kickoff'; te:='Second half started'; ta:='انطلاق الشوط الثاني';
  ELSIF NEW.status IN ('ft','aet','pen') THEN cat:='final'; te:='Full time'; ta:='نهاية المباراة';
  ELSE RETURN NEW; END IF;
  PERFORM enqueue_match_push(NEW.id, cat, NULL, NULL,
    te, coalesce(h.name,'Home') || ' ' || sc || ' ' || coalesce(a.name,'Away'),
    ta, coalesce(h.name_ar,h.name,'') || ' ' || sc || ' ' || coalesce(a.name_ar,a.name,''));
  RETURN NEW;
END $$;
CREATE TRIGGER match_status_push AFTER UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.match_status_push();

CREATE OR REPLACE FUNCTION public.match_event_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m matches; h teams; a teams; t teams; p players; cat text; te text; ta text; mn text; pe text; pa text;
BEGIN
  IF NEW.type NOT IN ('goal','penalty_goal','own_goal','red','second_yellow','penalty_miss') THEN RETURN NEW; END IF;
  SELECT * INTO m FROM matches WHERE id = NEW.match_id;
  IF m.status NOT IN ('live','1h','ht','2h','et') THEN RETURN NEW; END IF;
  SELECT * INTO h FROM teams WHERE id = m.home_team_id;
  SELECT * INTO a FROM teams WHERE id = m.away_team_id;
  SELECT * INTO t FROM teams WHERE id = NEW.team_id;
  SELECT * INTO p FROM players WHERE id = NEW.player_id;
  mn := coalesce(NEW.minute::text || '''', '');
  pe := coalesce(p.short_name, p.name, ''); pa := coalesce(p.name_ar, p.short_name, p.name, '');
  IF NEW.type IN ('goal','penalty_goal','own_goal') THEN
    cat := 'goals';
    te := '⚽ Goal! ' || coalesce(t.name,'');
    ta := '⚽ هدف! ' || coalesce(t.name_ar,t.name,'');
    IF NEW.type='penalty_goal' THEN pe := pe || ' (pen)'; pa := pa || ' (ركلة جزاء)'; END IF;
    IF NEW.type='own_goal' THEN pe := pe || ' (OG)'; pa := pa || ' (هدف عكسي)'; END IF;
  ELSIF NEW.type='penalty_miss' THEN cat:='goals'; te:='❌ Penalty missed'; ta:='❌ ركلة جزاء ضائعة';
  ELSE cat:='cards'; te:='🟥 Red card'; ta:='🟥 بطاقة حمراء';
  END IF;
  PERFORM enqueue_match_push(m.id, cat, NEW.team_id, NEW.player_id,
    te, trim(mn || ' ' || pe) || ' · ' || coalesce(h.name,'') || ' vs ' || coalesce(a.name,''),
    ta, trim(mn || ' ' || pa) || ' · ' || coalesce(h.name_ar,h.name,'') || ' ضد ' || coalesce(a.name_ar,a.name,''));
  RETURN NEW;
END $$;
CREATE TRIGGER match_event_push AFTER INSERT ON public.match_events FOR EACH ROW EXECUTE FUNCTION public.match_event_push();