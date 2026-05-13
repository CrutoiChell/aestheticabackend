-- Migration V5: add gallery_image_urls column to exhibitions
-- Run this in Supabase SQL Editor

ALTER TABLE exhibitions 
ADD COLUMN IF NOT EXISTS gallery_image_urls TEXT[] DEFAULT '{}';

-- Backfill existing rows: put image_url into the array
UPDATE exhibitions 
SET gallery_image_urls = ARRAY[image_url]
WHERE gallery_image_urls IS NULL OR gallery_image_urls = '{}';

-- Add avatar_url and bio columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add user_id to artworks if missing (old schema)
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add allow_user_images to exhibitions if missing
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS allow_user_images BOOLEAN DEFAULT false;
