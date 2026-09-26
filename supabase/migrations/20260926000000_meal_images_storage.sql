-- Storage for admin-uploaded meal photos (Edit Meal's image picker). Public
-- read (meal photos are shown to every app user), TEMP permissive write —
-- same "no enforced admin role yet" reasoning as the ingredients/meals TEMP
-- write policies (see 20260909125621_ingredients_add_archive_and_write_policy.sql).
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

create policy "Anyone can view meal images"
  on storage.objects for select
  using (bucket_id = 'meal-images');

create policy "TEMP: anyone can upload meal images"
  on storage.objects for insert
  with check (bucket_id = 'meal-images');

create policy "TEMP: anyone can update meal images"
  on storage.objects for update
  using (bucket_id = 'meal-images');
