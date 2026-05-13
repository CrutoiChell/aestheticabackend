-- Art Gallery Platform Database Schema V3
-- Adds likes and comments functionality
-- Run this SQL in your Supabase SQL Editor

-- Likes table (users can like exhibitions)
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exhibition_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_exhibition ON likes(exhibition_id);

-- Comments table (users can comment on exhibitions)
CREATE TABLE IF NOT EXISTS comments (
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

-- Add likes_count to exhibitions table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exhibitions' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE exhibitions ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add comments_count to exhibitions table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exhibitions' AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE exhibitions ADD COLUMN comments_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to update likes count
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

-- Function to update comments count
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

-- Triggers for likes
DROP TRIGGER IF EXISTS trigger_update_likes_count ON likes;
CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_exhibition_likes_count();

-- Triggers for comments
DROP TRIGGER IF EXISTS trigger_update_comments_count ON comments;
CREATE TRIGGER trigger_update_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_exhibition_comments_count();

-- Disable RLS for new tables
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
