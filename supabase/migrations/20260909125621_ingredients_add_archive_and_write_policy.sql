alter table public.ingredients add column archived_at timestamptz;

-- TEMPORARY: permissive write policy. Real auth (Google sign-in) is
-- currently blocked (see docs/ingredient-data-architecture.md and the
-- backend workflow plan), so there's no way to test against a real
-- authenticated admin session yet — same reasoning as the client-side
-- hardcoded `isAdmin = true` in Header.tsx. Replace with a real check once
-- auth works, e.g.:
--   using (exists (select 1 from public.users where id = auth.uid() and tier = 'admin'))
create policy "TEMP: anyone can update ingredients"
  on public.ingredients
  for update
  using (true);
