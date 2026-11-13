-- Both photo buckets accept images only (the last step of the storage
-- audit, 20261113020000). Safe now: the app uploads raw bytes typed from
-- the file extension (lib/imageUpload.ts, confirmed on a phone 2026-11-13);
-- Blob uploads used to arrive as text/plain. Checked on upload only, so the
-- few older text/plain files stay readable. Same list lib/imageUpload.ts
-- can produce.
update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
  where id in ('meal-images', 'post-images');
