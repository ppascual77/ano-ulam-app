-- A user's saved meals. Each save is a snapshot of the meal at save time,
-- scaled to the servings they picked (meal_data), so the Saved tab can show
-- "this recipe was updated / removed since you saved it" by comparing it with
-- the live catalog meal. Owner-only, like the web app's table.
create table public.saved_meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- The catalog meal it came from. Null once that meal is deleted
  -- (the snapshot stays, shown as "removed").
  meal_id      uuid references public.meals(id) on delete set null,
  -- What "already saved?" checks key on: the catalog id, or the normalized
  -- name for meals without one (the app's savedKeyOf).
  meal_key     text not null,
  -- The meal as saved, ingredients included, scaled to serving_size.
  meal_data    jsonb not null,
  serving_size integer not null default 1 check (serving_size between 1 and 50),
  saved_at     timestamptz not null default now(),
  -- When the snapshot was last re-based ("Sync latest version" or a
  -- servings change); compared with meals.updated_at for "updated".
  synced_at    timestamptz not null default now(),
  unique (user_id, meal_key)
);

create index saved_meals_user_saved_at on public.saved_meals (user_id, saved_at desc);
create index saved_meals_meal_id on public.saved_meals (meal_id);

alter table public.saved_meals enable row level security;

create policy "Users read own saves" on public.saved_meals
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add own saves" on public.saved_meals
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own saves" on public.saved_meals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own saves" on public.saved_meals
  for delete to authenticated using (auth.uid() = user_id);

-- The 15-save cap, enforced here too (RLS is the only boundary; the app's
-- own check can be bypassed). Matches SAVED_MEALS_LIMIT in core/saved/types.ts.
create function public.enforce_saved_meals_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_meals where user_id = new.user_id) >= 15 then
    raise exception 'saved meals limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger saved_meals_limit
  before insert on public.saved_meals
  for each row execute function public.enforce_saved_meals_limit();
