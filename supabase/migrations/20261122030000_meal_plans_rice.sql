-- The meal plan's rice (BUG-9): cups of cooked rice per person with each meal that goes with rice
-- (any slot), counted in the plan's nutrition, cost and grocery list. Chosen
-- before building, so the plan is fitted around it.
--
-- null = a plan saved before rice was counted: it reopens without rice, so
-- its numbers stay the ones it was built with. Older app versions don't send
-- it (an update leaves it as it is; a new row from them gets null, no rice,
-- which is what those versions show).
alter table public.meal_plans
  add column rice_cups smallint check (rice_cups between 0 and 2);
