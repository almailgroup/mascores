ALTER TABLE public.voice_recordings ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS chat_log jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_follows boolean NOT NULL DEFAULT false;
ALTER TABLE public.news_reporters ADD COLUMN IF NOT EXISTS selfie_photo_path text;

CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY,
  phone text,
  email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage contacts" ON public.profile_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.display_voice_badge(_user uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE WHEN public.is_main_admin(_user) AND EXISTS (SELECT 1 FROM profiles WHERE id=_user AND lower(username)='mascores') THEN 'owner' ELSE (SELECT badge FROM public.voice_user_badges WHERE user_id=_user AND badge <> 'owner') END $$;

CREATE OR REPLACE FUNCTION public.social_profile(_username text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url,'bio',CASE WHEN public.can_view_social_profile(p.id) THEN p.bio ELSE NULL END,'is_public',p.is_public,'can_view',public.can_view_social_profile(p.id),'hide_follows',p.hide_follows AND p.id IS DISTINCT FROM auth.uid(),'followers',CASE WHEN p.hide_follows AND p.id IS DISTINCT FROM auth.uid() THEN NULL ELSE (SELECT count(*) FROM profile_follows WHERE following_id=p.id) END,'following',CASE WHEN p.hide_follows AND p.id IS DISTINCT FROM auth.uid() THEN NULL ELSE (SELECT count(*) FROM profile_follows WHERE follower_id=p.id) END,'recordings',(SELECT count(*) FROM voice_recordings r WHERE r.host_id=p.id AND (r.is_public OR p.id=auth.uid())),'badge',public.display_voice_badge(p.id)) FROM profiles p WHERE lower(p.username)=lower(_username) OR p.id::text=_username LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.social_follow_list(_user uuid, _kind text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT p.id,p.username,p.display_name,p.avatar_url FROM profile_follows f JOIN profiles p ON p.id=CASE WHEN _kind='followers' THEN f.follower_id ELSE f.following_id END WHERE public.can_view_social_profile(_user) AND (_user=auth.uid() OR NOT COALESCE((SELECT hide_follows FROM profiles WHERE id=_user),false)) AND CASE WHEN _kind='followers' THEN f.following_id ELSE f.follower_id END=_user ORDER BY f.created_at DESC LIMIT 200 $$;