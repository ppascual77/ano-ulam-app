-- The Meal Planner's plan, saved to the account: one current plan per user
-- (building a new one replaces it). Holds the inputs and, per day, the meal
-- id in each slot; the meals themselves come from the catalog when the plan
-- is opened, so a plan never carries stale copies. Owner-only.
create table public.meal_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- Day 1 of the plan (the user's local date); the rest follow daily.
  start_date date not null,
  -- The weekly budget and how many people it's cooked for.
  budget     numeric not null check (budget > 0),
  servings   integer not null check (servings between 1 and 20),
  -- Daily macro targets ({calories, protein, carbs, fats}) and the goal
  -- they were made for; null when the macro goal is off.
  targets    jsonb,
  goal       text,
  -- One entry per day: {"breakfast": "<meal id>", "lunch": ..., "dinner": ...}.
  days       jsonb not null check (jsonb_typeof(days) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.meal_plans enable row level security;
create policy "Users read own plan" on public.meal_plans
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add own plan" on public.meal_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own plan" on public.meal_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users remove own plan" on public.meal_plans
  for delete to authenticated using (auth.uid() = user_id);

-- Grocery checkboxes now belong to one of two lists: the saved-meals list
-- (every existing row) or the meal plan's. Same item can be ticked on one
-- and not the other.
alter table public.grocery_checks
  add column list text not null default 'saved' check (list in ('saved', 'plan'));
alter table public.grocery_checks drop constraint grocery_checks_pkey;
alter table public.grocery_checks add primary key (user_id, list, item_key);
