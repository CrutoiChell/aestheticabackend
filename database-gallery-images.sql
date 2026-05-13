-- Галерея выставки: несколько URL. Один раз в Supabase SQL editor.

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB DEFAULT '[]'::jsonb;

UPDATE exhibitions
SET gallery_image_urls = jsonb_build_array(image_url)
WHERE btrim(COALESCE(image_url, '')) <> ''
  AND jsonb_array_length(COALESCE(gallery_image_urls, '[]'::jsonb)) = 0;
