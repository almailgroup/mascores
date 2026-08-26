-- Initialize Mascores Database
-- This combines all migrations into one setup script

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create users table (Supabase auth)
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMP,
  invited_at TIMESTAMP,
  confirmation_token VARCHAR(255),
  confirmation_sent_at TIMESTAMP,
  recovery_token VARCHAR(255),
  recovery_sent_at TIMESTAMP,
  email_change_token VARCHAR(255),
  email_change VARCHAR(255),
  email_change_sent_at TIMESTAMP,
  last_sign_in_at TIMESTAMP,
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Public schema
CREATE SCHEMA IF NOT EXISTS public;

-- Create competitions table
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255),
  type VARCHAR(50),
  logo_url TEXT,
  description TEXT,
  slug VARCHAR(255) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255),
  logo_url TEXT,
  description TEXT,
  slug VARCHAR(255) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  position VARCHAR(100),
  jersey_number INT,
  photo_url TEXT,
  date_of_birth DATE,
  nationality VARCHAR(255),
  height INT,
  weight INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES public.competitions(id),
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'scheduled',
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  venue VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create news_posts table
CREATE TABLE IF NOT EXISTS public.news_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  featured_image_url TEXT,
  published_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'draft',
  slug VARCHAR(500) UNIQUE,
  excerpt VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  match_id UUID REFERENCES public.matches(id),
  team_id UUID REFERENCES public.teams(id),
  player_id UUID REFERENCES public.players(id),
  competition_id UUID REFERENCES public.competitions(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_matches_competition_id ON public.matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_team_id ON public.matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team_id ON public.matches(away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_author_id ON public.news_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_status ON public.news_posts(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON public.news_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);

-- Sample data
INSERT INTO public.competitions (name, country, type, slug) VALUES
  ('Premier League', 'England', 'league', 'premier-league'),
  ('La Liga', 'Spain', 'league', 'la-liga'),
  ('Serie A', 'Italy', 'league', 'serie-a'),
  ('Bundesliga', 'Germany', 'league', 'bundesliga'),
  ('Ligue 1', 'France', 'league', 'ligue-1')
ON CONFLICT DO NOTHING;

INSERT INTO public.teams (name, country, slug) VALUES
  ('Manchester United', 'England', 'manchester-united'),
  ('Manchester City', 'England', 'manchester-city'),
  ('Liverpool', 'England', 'liverpool'),
  ('Real Madrid', 'Spain', 'real-madrid'),
  ('Barcelona', 'Spain', 'barcelona'),
  ('Bayern Munich', 'Germany', 'bayern-munich'),
  ('Juventus', 'Italy', 'juventus'),
  ('PSG', 'France', 'psg')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "News posts are viewable by everyone" ON public.news_posts
  FOR SELECT USING (status = 'published' OR auth.uid() = author_id);

CREATE POLICY "Matches are viewable by everyone" ON public.matches
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can view their own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
