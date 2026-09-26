-- Lets price be computed from a DIFFERENT effective quantity than macros
-- for the same ingredient row — e.g. bulk deep-frying oil, where the cook
-- buys/uses a full cup (what price should reflect) but the dish only
-- absorbs a fraction of it (what macros should reflect). Null (the
-- default) means price falls back to quantity_amount/quantity_unit
-- exactly as before — zero behavior change for every existing row.
alter table public.meal_ingredients add column price_quantity_amount numeric;
alter table public.meal_ingredients add column price_quantity_unit text;
