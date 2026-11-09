-- RLS lockdown before release: replaces the 12 "TEMP: anyone can ..."
-- write policies (from the solo-admin phase) with admin-only writes, keeping
-- exactly the writes regular users need for Add a Recipe.
--
-- Who writes what (checked against the app on 2026-11-09):
-- - Admins (app_metadata role = admin, public.is_admin()): everything below,
--   from the admin screens (Manage Meals/Ingredients, Seed Meal, Review
--   Recipes, DA Daily Prices). The /seed-meal skill and delete-account use
--   the service role, which bypasses RLS, so they're unaffected.
-- - Signed-in users, for their own recipe only (meals.poster_id = them):
--   submitRecipe inserts a *pending* meal, uploads its cover photo to
--   meal-images/<meal id>/, sets image_url, adds its meal_ingredients and
--   recomputes its totals. Profile's Created tab deletes their own recipe
--   (and its photos). They can't approve their own recipe (status stays
--   'pending' on insert and update), which also keeps the first-recipe Pro
--   reward honest.
-- - Edge functions only parse or look things up and return the result; the
--   app writes it, so they need no policy here.
-- - Guests (anon): read only. (The dev-build "submit without a session" test
--   path, poster_id null, stops working, by design.)
--
-- Reads are unchanged: meals, meal_ingredients, ingredients, DA commodities,
-- daily prices and meal images stay publicly readable.

-- ---- drop the TEMP policies ------------------------------------------------
drop policy "TEMP: anyone can update ingredients" on public.ingredients;
drop policy "TEMP: anyone can insert ingredients" on public.ingredients;
drop policy "TEMP: anyone can write meals" on public.meals;
drop policy "TEMP: anyone can write meal ingredients" on public.meal_ingredients;
drop policy "TEMP: anyone can insert DA commodities" on public.da_commodities;
drop policy "TEMP: anyone can update DA commodities" on public.da_commodities;
drop policy "TEMP: anyone can insert daily prices" on public.daily_prices;
drop policy "TEMP: anyone can update daily prices" on public.daily_prices;
drop policy "TEMP: anyone can upload meal images" on storage.objects;
drop policy "TEMP: anyone can update meal images" on storage.objects;
drop policy "TEMP: anyone can delete meal images" on storage.objects;

-- ---- reference data: admin-only writes ------------------------------------
-- `to authenticated` only: is_admin() isn't executable by anon, and guests
-- never write.
create policy "Admins write ingredients" on public.ingredients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins write DA commodities" on public.da_commodities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins write daily prices" on public.daily_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- meals -----------------------------------------------------------------
create policy "Admins write meals" on public.meals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users submit own pending recipe" on public.meals
  for insert to authenticated
  with check (poster_id = auth.uid() and status = 'pending');

create policy "Users edit own pending recipe" on public.meals
  for update to authenticated
  using (poster_id = auth.uid() and status = 'pending')
  with check (poster_id = auth.uid() and status = 'pending');

create policy "Users delete own recipe" on public.meals
  for delete to authenticated
  using (poster_id = auth.uid());

-- ---- meal_ingredients --------------------------------------------------------
create policy "Admins write meal ingredients" on public.meal_ingredients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lines of the user's own pending recipe (deleting the recipe cascades).
create policy "Users write own pending recipe lines" on public.meal_ingredients
  for all to authenticated
  using (exists (
    select 1 from public.meals m
    where m.id = meal_ingredients.meal_id and m.poster_id = auth.uid() and m.status = 'pending'
  ))
  with check (exists (
    select 1 from public.meals m
    where m.id = meal_ingredients.meal_id and m.poster_id = auth.uid() and m.status = 'pending'
  ));

-- ---- meal-images bucket ------------------------------------------------------
-- Photos live under `<meal id>/<file>`. Admins write any; a user writes only
-- under their own recipe's folder (upload is an upsert, so update too), and
-- removes them when deleting the recipe. `objects.name` (the file path) is
-- qualified on purpose: a bare `name` inside the meals subquery would mean
-- meals.name.
create policy "Admins write meal images" on storage.objects
  for all to authenticated
  using (bucket_id = 'meal-images' and public.is_admin())
  with check (bucket_id = 'meal-images' and public.is_admin());

create policy "Users upload own recipe photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-images'
    and exists (select 1 from public.meals m where m.id::text = (storage.foldername(objects.name))[1] and m.poster_id = auth.uid())
  );

create policy "Users replace own recipe photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-images'
    and exists (select 1 from public.meals m where m.id::text = (storage.foldername(objects.name))[1] and m.poster_id = auth.uid())
  );

create policy "Users delete own recipe photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-images'
    and exists (select 1 from public.meals m where m.id::text = (storage.foldername(objects.name))[1] and m.poster_id = auth.uid())
  );
