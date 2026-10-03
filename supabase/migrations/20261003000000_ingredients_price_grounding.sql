-- Supermarket price grounding (Manage Ingredients → "Ground Prices" tab,
-- edge function ground-ingredient-prices). Same shape as USDA grounding:
-- a lookup returns a candidate with its source, the admin accepts it, and
-- only then is it written here.
--
-- 'supermarket' marks a price taken from a real PH supermarket online
-- listing, distinct from the seed's AI-estimated 'manual' placeholders and
-- the future Price Watch pipeline. Still a snapshot on `ingredients`, not
-- the price_observations history docs/ingredient-data-architecture.md
-- section 11 describes; that's Price Watch's job.
alter table public.ingredients drop constraint ingredients_price_source_check;
alter table public.ingredients add constraint ingredients_price_source_check
  check (price_source in ('manual', 'price_watch', 'supermarket'));

-- The listing the price came from, so a number can always be traced back
-- and re-checked (same idea as source_ref_id → USDA's food page).
alter table public.ingredients add column price_source_url text;
-- Human-readable "Store · product title · pack price", shown in admin.
alter table public.ingredients add column price_source_label text;

-- NULL means never price-checked; set on every grounding run regardless of
-- outcome, same reasoning as usda_last_attempted_at
-- (20260919000000_ingredients_track_usda_grounding_attempts.sql): without
-- it, the default pool keeps resurfacing rows already looked at.
alter table public.ingredients add column price_last_attempted_at timestamptz;
