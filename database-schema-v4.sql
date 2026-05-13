-- Art Gallery Platform Database Schema V4
-- Полная переработка: выставки как коллекции пользователей
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- USERS TABLE (если еще не создана)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- EXHIBITIONS TABLE (обновленная)
-- ============================================
DROP TABLE IF EXISTS exhibitions CASCADE;

CREATE TABLE exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  gallery VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image_url TEXT NOT NULL,
  gallery_image_urls JSONB DEFAULT '[]'::jsonb,
  location VARCHAR(255),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  allow_user_images BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  artworks_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exhibitions_user ON exhibitions(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibitions_public ON exhibitions(is_public);
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(start_date, end_date);

-- ============================================
-- ARTWORKS TABLE (обновленная)
-- ============================================
DROP TABLE IF EXISTS artworks CASCADE;

CREATE TABLE artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  year INTEGER NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  medium VARCHAR(255),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  dimension_unit VARCHAR(10) DEFAULT 'cm' CHECK (dimension_unit IN ('cm', 'in')),
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artworks_exhibition ON artworks(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_artworks_user ON artworks(user_id);

-- ============================================
-- LIKES TABLE
-- ============================================
DROP TABLE IF EXISTS likes CASCADE;

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exhibition_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_exhibition ON likes(exhibition_id);

-- ============================================
-- COMMENTS TABLE
-- ============================================
DROP TABLE IF EXISTS comments CASCADE;

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_exhibition ON comments(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- ============================================
-- TRIGGERS FOR LIKES COUNT
-- ============================================
CREATE OR REPLACE FUNCTION update_exhibition_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exhibitions 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.exhibition_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exhibitions 
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.exhibition_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_likes_count ON likes;
CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_exhibition_likes_count();

-- ============================================
-- TRIGGERS FOR COMMENTS COUNT
-- ============================================
CREATE OR REPLACE FUNCTION update_exhibition_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exhibitions 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.exhibition_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exhibitions 
    SET comments_count = GREATEST(comments_count - 1, 0)
    WHERE id = OLD.exhibition_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comments_count ON comments;
CREATE TRIGGER trigger_update_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_exhibition_comments_count();

-- ============================================
-- TRIGGERS FOR ARTWORKS COUNT
-- ============================================
CREATE OR REPLACE FUNCTION update_exhibition_artworks_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exhibitions 
    SET artworks_count = artworks_count + 1 
    WHERE id = NEW.exhibition_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exhibitions 
    SET artworks_count = GREATEST(artworks_count - 1, 0)
    WHERE id = OLD.exhibition_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artworks_count ON artworks;
CREATE TRIGGER trigger_update_artworks_count
AFTER INSERT OR DELETE ON artworks
FOR EACH ROW EXECUTE FUNCTION update_exhibition_artworks_count();

-- ============================================
-- FUNCTION FOR PLATFORM STATS
-- ============================================
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  users_count BIGINT,
  exhibitions_count BIGINT,
  artworks_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM exhibitions WHERE is_public = true) as exhibitions_count,
    (SELECT COUNT(*) FROM artworks) as artworks_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DISABLE RLS (Row Level Security)
-- ============================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE artworks DISABLE ROW LEVEL SECURITY;
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- SAMPLE DATA (опционально)
-- ============================================
-- Вставьте тестовые данные если нужно
