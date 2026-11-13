-- RLS audit (2026-11-13): every public table has RLS on and sensible write
-- rules; these three read rules were too open.
--
-- 1. meals: "Anyone can view meals" (USING true) let anyone, guests too,
--    read every user's pending and rejected recipe submissions (their
--    poster_id, rejection_reason, cover photo URL) straight from the API.
--    Now: approved meals for everyone (archiving uses archived_at, so
--    archived meals someone saved stay readable), a user's own recipes
--    whatever their status, and everything for admins (the existing
--    "Admins write meals" FOR ALL policy already covers SELECT).
-- 2. meal_ingredients: same rule, following the parent meal.
-- 3. food_posts: "Signed-in users read posts" (USING true) let any signed-in
--    user read posts that moderation removed or hid (hidden_at) through the
--    table API; the feed's get_food_posts already left them out. Now: visible
--    posts, your own (labelled removed in the app), and everything for
--    admins (Reported Posts).
--
-- `to anon, authenticated` on the approved-meals rule (not `public`): is_admin()
-- isn't executable by anon, so admin checks stay in authenticated-only rules.

-- ---- meals -----------------------------------------------------------------
drop policy "Anyone can view meals" on public.meals;

create policy "Anyone can view approved meals" on public.meals
  for select to anon, authenticated
  using (status = 'approved');

create policy "Users view own recipes" on public.meals
  for select to authenticated
  using (poster_id = auth.uid());

-- ---- meal_ingredients --------------------------------------------------------
drop policy "Anyone can view meal ingredients" on public.meal_ingredients;

create policy "Anyone can view approved meal lines" on public.meal_ingredients
  for select to anon, authenticated
  using (exists (select 1 from public.meals m where m.id = meal_ingredients.meal_id and m.status = 'approved'));

create policy "Users view own recipe lines" on public.meal_ingredients
  for select to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_ingredients.meal_id and m.poster_id = auth.uid()));

-- ---- food_posts ----------------------------------------------------------------
drop policy "Signed-in users read posts" on public.food_posts;

create policy "Signed-in users read visible posts" on public.food_posts
  for select to authenticated
  using (hidden_at is null or user_id = auth.uid() or public.is_admin());
