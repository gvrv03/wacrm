-- ============================================================
-- 021: Create template-media storage bucket with RLS policies
--
-- Used by: Templates, Chat Bot, Flows (image/document uploads)
-- Public read so WhatsApp API can fetch media URLs.
-- Write restricted to authenticated users in their own folder.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  true,
  16777216, -- 16 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (WhatsApp API needs to fetch media by URL)
DROP POLICY IF EXISTS "Media is publicly readable" ON storage.objects;
CREATE POLICY "Media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-media');

-- Users can upload to their own folder ({user_id}/...)
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
CREATE POLICY "Users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'template-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
CREATE POLICY "Users can update own media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'template-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'template-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
