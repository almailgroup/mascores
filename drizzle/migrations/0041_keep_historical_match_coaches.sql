CREATE OR REPLACE FUNCTION public.stamp_match_coaches_before_coach_move()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- The coach leaving a club keeps the club's already-played matches.
  IF OLD.team_id IS NOT NULL AND OLD.team_id IS DISTINCT FROM NEW.team_id THEN
    UPDATE matches SET home_coach_id = OLD.id WHERE home_team_id = OLD.team_id AND home_coach_id IS NULL AND kickoff_at < now();
    UPDATE matches SET away_coach_id = OLD.id WHERE away_team_id = OLD.team_id AND away_coach_id IS NULL AND kickoff_at < now();
  END IF;
  -- A club's previous coach keeps its played matches when someone new is appointed.
  IF NEW.team_id IS NOT NULL AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    UPDATE matches m SET home_coach_id = c.id FROM (SELECT id FROM coaches WHERE team_id = NEW.team_id AND id <> NEW.id LIMIT 1) c
      WHERE m.home_team_id = NEW.team_id AND m.home_coach_id IS NULL AND m.kickoff_at < now();
    UPDATE matches m SET away_coach_id = c.id FROM (SELECT id FROM coaches WHERE team_id = NEW.team_id AND id <> NEW.id LIMIT 1) c
      WHERE m.away_team_id = NEW.team_id AND m.away_coach_id IS NULL AND m.kickoff_at < now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS coaches_stamp_matches ON public.coaches;
CREATE TRIGGER coaches_stamp_matches BEFORE UPDATE OF team_id ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.stamp_match_coaches_before_coach_move();

CREATE OR REPLACE FUNCTION public.stamp_match_coaches_on_start()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'scheduled' AND (TG_OP = 'INSERT' OR OLD.status = 'scheduled') THEN
    IF NEW.home_coach_id IS NULL AND NEW.home_team_id IS NOT NULL THEN
      NEW.home_coach_id := (SELECT id FROM coaches WHERE team_id = NEW.home_team_id LIMIT 1);
    END IF;
    IF NEW.away_coach_id IS NULL AND NEW.away_team_id IS NOT NULL THEN
      NEW.away_coach_id := (SELECT id FROM coaches WHERE team_id = NEW.away_team_id LIMIT 1);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS matches_stamp_coaches ON public.matches;
CREATE TRIGGER matches_stamp_coaches BEFORE INSERT OR UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.stamp_match_coaches_on_start();