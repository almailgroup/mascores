CREATE OR REPLACE FUNCTION public.seed_match_stats() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('live','ht','et','pen_live') AND COALESCE(OLD.status,'scheduled') = 'scheduled'
     AND NOT EXISTS (SELECT 1 FROM match_stats WHERE match_id = NEW.id) THEN
    INSERT INTO match_stats(match_id,label,home_value,away_value,sort_order)
    SELECT NEW.id, l, v, v, o FROM (VALUES ('Ball possession','50%',0),('Total shots','0',1),('Shots on target','0',2),('Corner kicks','0',3),('Fouls','0',4),('Offsides','0',5),('Yellow cards','0',6),('Red cards','0',7)) s(l,v,o);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS seed_match_stats ON public.matches;
CREATE TRIGGER seed_match_stats AFTER UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.seed_match_stats();

CREATE OR REPLACE FUNCTION public.sync_card_stats() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; m uuid := COALESCE(NEW.match_id, OLD.match_id); hy int; ay int; hr int; ar int; nxt int;
BEGIN
  IF COALESCE(NEW.type, OLD.type) NOT IN ('yellow','second_yellow','red') THEN RETURN NULL; END IF;
  SELECT * INTO r FROM matches WHERE id = m;
  SELECT count(*) FILTER (WHERE team_id=r.home_team_id AND type IN ('yellow','second_yellow')),
         count(*) FILTER (WHERE team_id=r.away_team_id AND type IN ('yellow','second_yellow')),
         count(*) FILTER (WHERE team_id=r.home_team_id AND type IN ('red','second_yellow')),
         count(*) FILTER (WHERE team_id=r.away_team_id AND type IN ('red','second_yellow'))
    INTO hy, ay, hr, ar FROM match_events WHERE match_id = m;
  SELECT COALESCE(max(sort_order)+1,0) INTO nxt FROM match_stats WHERE match_id = m;
  UPDATE match_stats SET home_value=hy::text, away_value=ay::text WHERE match_id=m AND label='Yellow cards';
  IF NOT FOUND THEN INSERT INTO match_stats(match_id,label,home_value,away_value,sort_order) VALUES (m,'Yellow cards',hy::text,ay::text,nxt); nxt := nxt+1; END IF;
  UPDATE match_stats SET home_value=hr::text, away_value=ar::text WHERE match_id=m AND label='Red cards';
  IF NOT FOUND THEN INSERT INTO match_stats(match_id,label,home_value,away_value,sort_order) VALUES (m,'Red cards',hr::text,ar::text,nxt); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sync_card_stats ON public.match_events;
CREATE TRIGGER sync_card_stats AFTER INSERT OR UPDATE OR DELETE ON public.match_events FOR EACH ROW EXECUTE FUNCTION public.sync_card_stats();

INSERT INTO public.match_stats(match_id,label,home_value,away_value,sort_order)
SELECT m.id, s.l, s.v, s.v, s.o FROM public.matches m
CROSS JOIN (VALUES ('Ball possession','50%',0),('Total shots','0',1),('Shots on target','0',2),('Corner kicks','0',3),('Fouls','0',4),('Offsides','0',5),('Yellow cards','0',6),('Red cards','0',7)) s(l,v,o)
WHERE m.status IN ('live','ht') AND NOT EXISTS (SELECT 1 FROM public.match_stats x WHERE x.match_id=m.id);