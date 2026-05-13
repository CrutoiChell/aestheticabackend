-- Art Gallery Platform Database Schema V2
-- Run this SQL in your Supabase SQL Editor

-- Drop existing tables if you want to recreate (CAREFUL!)
-- DROP TABLE IF EXISTS favorites CASCADE;
-- DROP TABLE IF EXISTS artworks CASCADE;
-- DROP TABLE IF EXISTS exhibitions CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Exhibitions table (with user_id for creator)
CREATE TABLE IF NOT EXISTS exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  gallery TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image_url TEXT NOT NULL,
  location TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exhibitions_gallery ON exhibitions(gallery);
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exhibitions_user ON exhibitions(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibitions_status ON exhibitions(status);

-- Artworks table
CREATE TABLE IF NOT EXISTS artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year INTEGER NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  dimensions JSONB,
  medium TEXT,
  exhibition_id UUID REFERENCES exhibitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artworks_exhibition ON artworks(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_artworks_artist ON artworks(artist);

-- Favorites table (user can favorite exhibitions)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exhibition_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_exhibition ON favorites(exhibition_id);

-- Add user_id column to existing exhibitions table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exhibitions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE exhibitions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX idx_exhibitions_user ON exhibitions(user_id);
  END IF;
END $$;

-- Add status column to existing exhibitions table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exhibitions' AND column_name = 'status'
  ) THEN
    ALTER TABLE exhibitions ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft'));
    CREATE INDEX idx_exhibitions_status ON exhibitions(status);
  END IF;
END $$;

-- Add views column to existing exhibitions table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exhibitions' AND column_name = 'views'
  ) THEN
    ALTER TABLE exhibitions ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add avatar_url and bio to existing users table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'bio'
  ) THEN
    ALTER TABLE users ADD COLUMN bio TEXT;
  END IF;
END $$;

-- Function to get platform statistics
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', (SELECT COUNT(*) FROM users),
    'exhibitions', (SELECT COUNT(*) FROM exhibitions WHERE status = 'active'),
    'artworks', (SELECT COUNT(*) FROM artworks),
    'favorites', (SELECT COUNT(*) FROM favorites)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for simplicity (enable and configure policies for production)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE artworks DISABLE ROW LEVEL SECURITY;
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;
