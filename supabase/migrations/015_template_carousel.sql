-- ============================================================
-- 015: Add carousel_cards and validity_period to message_templates
--      + Create template-media storage bucket
-- ============================================================

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS carousel_cards JSONB DEFAULT NULL;

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS validity_period_minutes INTEGER DEFAULT NULL;

-- ============================================================
-- Storage bucket for template media samples (header images/videos,
-- carousel card images). Public so preview URLs work without signing.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Template media is publicly readable" ON storage.objects;
CREATE POLICY "Template media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-media');

DROP POLICY IF EXISTS "Users can upload template media" ON storage.objects;
CREATE POLICY "Users can upload template media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'template-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own template media" ON storage.objects;
CREATE POLICY "Users can delete own template media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'template-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
