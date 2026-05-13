-- Расширение выставок: несколько URL + чужие фото.
-- Один раз в Supabase SQL editor.

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB DEFAULT '[]'::jsonb;

UPDATE exhibitions
SET gallery_image_urls = jsonb_build_array(image_url)
WHERE btrim(COALESCE(image_url, '')) <> ''
  AND jsonb_array_length(COALESCE(gallery_image_urls, '[]'::jsonb)) = 0;

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS allow_user_images BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS exhibition_user_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exhibition_user_images_exhibition
  ON exhibition_user_images(exhibition_id);
