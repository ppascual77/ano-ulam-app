-- estimated_price_unit must be a weight/volume unit so price can be
-- computed from a recipe quantity via the SAME grams-based pipeline
-- nutrition already uses (universal unit math + grams_per_ml) — a discrete
-- unit like "piece" or "pack" has no conversion bridge to grams, so price
-- for a partial/arbitrary recipe quantity couldn't be computed at all.
-- See docs/ingredient-data-architecture.md section 23.
--
-- Re-expresses the two 'pack'-priced seed rows as an equivalent price per
-- kg, estimating a typical small retail pack size for each (bay leaf ~5g,
-- ground pepper ~20g) — still an AI-estimated placeholder (price_source
-- stays 'manual'), just now in a convertible unit.
update public.ingredients
set estimated_price = 3000, estimated_price_unit = 'kg'
where canonical_name = 'Bay leaf' and estimated_price_unit = 'pack';

update public.ingredients
set estimated_price = 1250, estimated_price_unit = 'kg'
where canonical_name = 'Black pepper, ground' and estimated_price_unit = 'pack';

alter table public.ingredients add constraint ingredients_price_unit_check
  check (estimated_price_unit is null or estimated_price_unit in ('g', 'kg', 'ml', 'L'));
