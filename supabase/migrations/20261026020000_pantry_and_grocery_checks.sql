-- The ingredients a user has at home (Home's "By Pantry", Profile's Pantry
-- tab, Grocery's "Have" tags). One row per ingredient; the name comes from
-- the ingredients table. Owner-only. (A guest's pantry stays on the phone
-- and is merged in here on sign-in.)
create table public.pantry_items (
  user_id       uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

alter table public.pantry_items enable row level security;
create policy "Users read own pantry" on public.pantry_items
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add to own pantry" on public.pantry_items
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users remove from own pantry" on public.pantry_items
  for delete to authenticated using (auth.uid() = user_id);

-- Checked items on a user's saved-meals grocery list. Keyed by the item's
-- lowercased catalog name (the list is rebuilt from saved meals, so there's
-- no row id to point at), holding the quantity it had when checked: if
-- that quantity changes, the item reads as unchecked (restock).
create table public.grocery_checks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_key   text not null,
  qty        text not null,
  checked_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.grocery_checks enable row level security;
create policy "Users read own checks" on public.grocery_checks
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add own checks" on public.grocery_checks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own checks" on public.grocery_checks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users remove own checks" on public.grocery_checks
  for delete to authenticated using (auth.uid() = user_id);
