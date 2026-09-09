-- role: "main" (a headline ingredient you'd shop for specifically, e.g.
-- chicken breast) vs "pantry" (a staple usually already on hand, e.g. salt,
-- cooking oil) — matches the existing mock IngredientType.type concept.
alter table public.ingredients add column role text;
alter table public.ingredients add constraint ingredients_role_check
  check (role is null or role in ('main', 'pantry'));

-- Estimated price is a deliberate stopgap, not the final procurement/price
-- system (see docs/ingredient-data-architecture.md section 11/12 — nutrition
-- and price are supposed to be separate concerns, with price eventually
-- needing full history/sourcing via Price Watch). No grounding source exists
-- for price yet, unlike nutrition's FNRI/USDA — price_source defaults to
-- 'manual' and stays that way until a real one exists.
alter table public.ingredients add column estimated_price numeric;
alter table public.ingredients add column estimated_price_unit text;
alter table public.ingredients add column price_source text not null default 'manual';
alter table public.ingredients add constraint ingredients_price_source_check
  check (price_source in ('manual', 'price_watch'));
alter table public.ingredients add column price_last_updated_at timestamptz;
