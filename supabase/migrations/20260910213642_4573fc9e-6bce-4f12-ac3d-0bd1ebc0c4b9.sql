-- 1. Main owner + delegated access -------------------------------------------
CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _uid AND lower(u.email) = 'mansouralmailscores@gmail.com'
  );
$$;

CREATE TABLE public.admin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('all','news','club_news','rabta','tickets','matches','voice')),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  requires_approval boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, team_id)
);
GRANT SELECT ON public.admin_grants TO authenticated;
GRANT ALL ON public.admin_grants TO service_role;
ALTER TABLE public.admin_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own grants" ON public.admin_grants FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_main_admin(auth.uid()));
CREATE TRIGGER admin_grants_updated_at BEFORE UPDATE ON public.admin_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_grant(_uid uuid, _scope text, _team uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_main_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.admin_grants g
    WHERE g.user_id = _uid
      AND (g.scope = 'all' OR g.scope = _scope)
      AND (g.team_id IS NULL OR g.team_id = _team)
  );
$$;

-- 2. Ultras / Rabta -----------------------------------------------------------
CREATE TABLE public.ultras_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  photo_url text,
  meeting_place text,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ultras_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ultras_posts TO authenticated;
GRANT ALL ON public.ultras_posts TO service_role;
ALTER TABLE public.ultras_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved ultras posts are public" ON public.ultras_posts FOR SELECT USING (status = 'approved');
CREATE POLICY "Authors and admins read their ultras posts" ON public.ultras_posts FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_grant(auth.uid(), 'rabta', team_id));
CREATE POLICY "Granted users write ultras posts" ON public.ultras_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_grant(auth.uid(), 'rabta', team_id)));
CREATE POLICY "Authors and admins update ultras posts" ON public.ultras_posts FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (author_id = auth.uid() AND public.has_grant(auth.uid(), 'rabta', team_id)));
CREATE POLICY "Authors and admins delete ultras posts" ON public.ultras_posts FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR author_id = auth.uid());
CREATE TRIGGER ultras_posts_updated_at BEFORE UPDATE ON public.ultras_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Profiles: username, visibility, bio -------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bio text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;
UPDATE public.profiles p
SET username = 'fan' || substr(replace(p.id::text, '-', ''), 1, 8)
WHERE p.username IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'fan' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Public directory of profiles people allowed to be found
CREATE OR REPLACE FUNCTION public.search_profiles(_q text, _limit integer DEFAULT 12)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, followers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         (SELECT count(*) FROM public.profile_follows f WHERE f.following_id = p.id)
  FROM public.profiles p
  WHERE p.is_public
    AND length(trim(coalesce(_q, ''))) > 1
    AND (p.username ILIKE '%' || trim(_q) || '%' OR coalesce(p.display_name, '') ILIKE '%' || trim(_q) || '%')
  ORDER BY 5 DESC
  LIMIT greatest(1, least(coalesce(_limit, 12), 40));
$$;

CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, is_public boolean, followers bigint, following bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.is_public,
         (SELECT count(*) FROM public.profile_follows f WHERE f.following_id = p.id),
         (SELECT count(*) FROM public.profile_follows f WHERE f.follower_id = p.id)
  FROM public.profiles p
  WHERE p.id = _id AND (p.is_public OR p.id = auth.uid());
$$;

-- 4. Voice rooms: live messages + published replays --------------------------
CREATE TABLE public.voice_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.voice_room_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.voice_room_messages TO authenticated;
GRANT ALL ON public.voice_room_messages TO service_role;
ALTER TABLE public.voice_room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room messages are readable" ON public.voice_room_messages FOR SELECT USING (true);
CREATE POLICY "Signed-in users post room messages" ON public.voice_room_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "Authors and admins delete room messages" ON public.voice_room_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
ALTER TABLE public.voice_recordings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 5. Tickets: resale ---------------------------------------------------------
ALTER TABLE public.ticket_offers ADD COLUMN IF NOT EXISTS resale_max_price numeric;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS resold_at timestamptz;

-- 6. Match reminders ---------------------------------------------------------
CREATE TABLE public.match_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id, minutes_before)
);
GRANT SELECT, INSERT, DELETE ON public.match_reminders TO authenticated;
GRANT ALL ON public.match_reminders TO service_role;
ALTER TABLE public.match_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reminders" ON public.match_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create own reminders" ON public.match_reminders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own reminders" ON public.match_reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 7. Clubs: contacts, colour, staff -----------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_website text,
  ADD COLUMN IF NOT EXISTS accent_color text;

CREATE TABLE public.team_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  photo_url text,
  nationality_code text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_staff TO authenticated;
GRANT ALL ON public.team_staff TO service_role;
ALTER TABLE public.team_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff are public" ON public.team_staff FOR SELECT USING (true);
CREATE POLICY "Admins manage staff" ON public.team_staff FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER team_staff_updated_at BEFORE UPDATE ON public.team_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Stadium directions ------------------------------------------------------
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS map_url text;

-- 9. Owner feedback ----------------------------------------------------------
CREATE TABLE public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.app_feedback TO anon;
GRANT SELECT, INSERT ON public.app_feedback TO authenticated;
GRANT ALL ON public.app_feedback TO service_role;
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send feedback" ON public.app_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read feedback" ON public.app_feedback FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));