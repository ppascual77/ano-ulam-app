-- TEMPORARY: permissive write policy, same reasoning/precedent as
-- "TEMP: anyone can update ingredients" (20260909125621). Missing entirely
-- until now — RLS was enabled with only SELECT/UPDATE policies, so every
-- INSERT (the meal seeder's "Add + use" USDA fallback, and the newer
-- AI-curated manual-add flow) was silently rejected by Postgres: the admin
-- client never saw an error surfaced, the ingredient never actually landed
-- in the table, and the meal ingredient stayed unlinked. Replace with a
-- real check once auth/admin roles exist, e.g.:
--   using (exists (select 1 from public.users where id = auth.uid() and tier = 'admin'))
create policy "TEMP: anyone can insert ingredients"
  on public.ingredients
  for insert
  with check (true);
