-- Storage audit (2026-11-13), the two public photo buckets.
--
-- 1. Size: no limit was set, so a signed-in user could park any amount of
--    data in their own folder of a public bucket. 10 MB per file is far
--    above what the app sends (photos are compressed; the biggest stored
--    file is 1.4 MB). An image-only MIME rule comes later, once the app's
--    upload fix (raw bytes with an image type, lib/imageUpload.ts) is on
--    every phone: until then the Blob uploads arrive typed text/plain.
-- 2. Listing: "Anyone can view meal/post images" let anyone list every file
--    in both buckets (user ids, pending recipe ids). Public buckets serve
--    their files by public URL without any policy, so those rules only ever
--    powered listing. Now you list your own folder (post-images/<your id>/,
--    meal-images/<your recipe id>/); admins keep everything in meal-images
--    through "Admins write meal images" (FOR ALL). Uploads with upsert and
--    deletes need to see the rows, which these keep.

update storage.buckets set file_size_limit = 10485760 where id in ('meal-images', 'post-images');

drop policy "Anyone can view meal images" on storage.objects;
drop policy "Anyone can view post images" on storage.objects;

create policy "Users see own post images" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users see own recipe photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-images'
    and exists (select 1 from public.meals m where m.id::text = (storage.foldername(objects.name))[1] and m.poster_id = auth.uid())
  );
