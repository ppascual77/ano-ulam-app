-- Missing from the original meal-images bucket policies (20260926000000):
-- SELECT/INSERT/UPDATE were added but not DELETE, so deleteMeal's Storage
-- cleanup would silently no-op under RLS — same class of gap as the
-- ingredients table's missing INSERT policy found earlier this project.
create policy "TEMP: anyone can delete meal images"
  on storage.objects for delete
  using (bucket_id = 'meal-images');
