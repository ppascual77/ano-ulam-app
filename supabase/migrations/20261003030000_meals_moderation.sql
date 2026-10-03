-- User-submitted recipes ("Add a Recipe" in Discover's Create sheet) with an
-- admin review step, lifting the v1 "read-only catalog, no moderation"
-- scope noted in 20260920000000_meals_init.sql. Same flow as the web app:
-- a user's recipe lands as 'pending', an admin approves or rejects it, and
-- only 'approved' meals are shown on consumer screens.
--
-- Every existing meal was seeded by an admin, so they all start approved.
alter table public.meals
  add column status text not null default 'approved',
  add constraint meals_status_check check (status in ('draft', 'pending', 'approved', 'rejected'));

-- Who submitted it. Null = an admin-seeded (official AnoUlam) meal, or a
-- dev-build test submission made without a signed-in session.
alter table public.meals
  add column poster_id uuid references public.users (id) on delete set null;

-- Shown to the poster when an admin rejects their recipe.
alter table public.meals add column rejection_reason text;

-- Ingredients a user typed that didn't match anything in the canonical
-- ingredients table. Kept here, NOT as meal_ingredients rows, so that
-- table keeps its guarantee that every row references a real ingredient
-- (see meals_init). An admin links each one during review, which turns it
-- into a real meal_ingredients row and removes it from this list; a meal
-- can't be approved while anything is left here.
--   [{ "name": "calamansi juice", "display_text": "2 tbsp calamansi juice",
--      "quantity_amount": 2, "quantity_unit": "ml" | null }, ...]
alter table public.meals
  add column unlinked_ingredients jsonb not null default '[]'::jsonb;

create index meals_status_idx on public.meals (status);
create index meals_poster_id_idx on public.meals (poster_id);
