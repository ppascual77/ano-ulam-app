-- Ingredients are shared reference data, not user-specific — readable by
-- anyone (including unauthenticated), but writes are intentionally left to
-- service_role only for now (the seeder / a future real admin check), since
-- there's no enforced admin role in the schema yet.
alter table public.ingredients enable row level security;

create policy "Anyone can view ingredients"
  on public.ingredients
  for select
  using (true);
