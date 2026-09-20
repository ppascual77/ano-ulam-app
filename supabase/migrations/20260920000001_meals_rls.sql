-- Same reasoning as ingredients (see 20260909121740_ingredients_rls.sql /
-- 20260909125621_ingredients_add_archive_and_write_policy.sql): meals are
-- shared reference data, publicly readable. Writes are temporarily wide
-- open since there's no enforced admin role in the schema yet (blocked on
-- the same Google OAuth redirect bug — supabase/auth#2039). Replace with a
-- real admin check once that's unblocked, e.g.:
--   using (exists (select 1 from public.users where id = auth.uid() and tier = 'admin'))
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;

-- archived_at filtering happens in the app query layer (api/meals.ts),
-- same convention as ingredients — not enforced at the RLS level, since an
-- admin screen still needs to see archived meals.
create policy "Anyone can view meals"
  on public.meals
  for select
  using (true);

create policy "TEMP: anyone can write meals"
  on public.meals
  for all
  using (true)
  with check (true);

create policy "Anyone can view meal ingredients"
  on public.meal_ingredients
  for select
  using (true);

create policy "TEMP: anyone can write meal ingredients"
  on public.meal_ingredients
  for all
  using (true)
  with check (true);
