-- Batch 6/~13: Eggs & dairy (15 items). Same treatment as batches 1-5 —
-- AI-estimated placeholders, honestly tagged source='manual',
-- verification_status='NEEDS_REVIEW', so the "Ground from USDA" tool has
-- real candidates to upgrade against, and any item it can't confidently
-- match still has usable (if approximate) data rather than nulls blocking
-- the meal-nutrition pipeline.
--
-- Liquid dairy (fresh milk, evaporated/condensed milk, all-purpose cream,
-- yogurt) uses basis_unit='ml' rather than 'g' — the nutrition basis is
-- still "per 100 units", just volume instead of mass for these, consistent
-- with the two-tier unit conversion design (app code already does the
-- universal ml<->L math; no ingredient-specific bridge needed here since
-- nothing in this batch is priced/measured by piece).
insert into public.ingredients (
  canonical_name, display_name, aliases, category, food_group, state, role,
  basis_amount, basis_unit, calories, protein, carbohydrates, fat, sugar, fiber, sodium,
  source, source_description, verification_status,
  estimated_price, estimated_price_unit, price_source,
  grams_per_piece, piece_label
) values
  ('Chicken egg, raw', 'Chicken egg', array['itlog', 'chicken egg', 'egg'], 'Egg', 'Eggs & Dairy', 'raw', 'main',
   100, 'g', 143, 12.6, 0.7, 9.5, 0.4, 0, 142, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   180, 'kg', 'manual', 50, 'egg'),
  ('Chicken egg, boiled', 'Boiled chicken egg', array['boiled egg', 'hard-boiled egg', 'itlog na nilaga'], 'Egg', 'Eggs & Dairy', 'cooked', 'main',
   100, 'g', 155, 12.6, 1.1, 10.6, 1.1, 0, 124, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   180, 'kg', 'manual', 50, 'egg'),
  ('Duck egg, raw', 'Duck egg', array['itlog ng pato', 'duck egg'], 'Egg', 'Eggs & Dairy', 'raw', 'main',
   100, 'g', 185, 12.8, 1.5, 13.8, 1.5, 0, 146, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   220, 'kg', 'manual', 70, 'egg'),
  ('Salted duck egg, cooked', 'Salted duck egg', array['itlog na maalat', 'salted egg', 'salted duck egg'], 'Egg', 'Eggs & Dairy', 'cooked', 'main',
   100, 'g', 195, 13, 1.4, 14, 0, 0, 900, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   280, 'kg', 'manual', 70, 'egg'),
  ('Balut, cooked', 'Balut', array['balut', 'boiled duck embryo'], 'Egg', 'Eggs & Dairy', 'cooked', 'main',
   100, 'g', 188, 13.5, 4.3, 11.2, 0, 0, 130, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   200, 'kg', 'manual', 70, 'balut'),
  ('Fresh milk, whole', 'Fresh milk', array['gatas', 'fresh milk', 'whole milk'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'ml', 61, 3.2, 4.8, 3.3, 4.8, 0, 43, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   90, 'L', 'manual', null, null),
  ('Evaporated milk, canned', 'Evaporated milk', array['evap', 'evaporated milk'], 'Dairy', 'Eggs & Dairy', 'cooked', 'pantry',
   100, 'ml', 134, 6.8, 10, 7.6, 10, 0, 106, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   220, 'L', 'manual', null, null),
  ('Condensed milk, sweetened, canned', 'Condensed milk', array['condensada', 'sweetened condensed milk'], 'Dairy', 'Eggs & Dairy', 'cooked', 'pantry',
   100, 'ml', 321, 7.9, 54.4, 8.7, 54.4, 0, 127, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   220, 'L', 'manual', null, null),
  ('Powdered milk, full cream', 'Powdered milk', array['milk powder', 'powdered milk'], 'Dairy', 'Eggs & Dairy', 'dried', 'pantry',
   100, 'g', 496, 26.3, 38.4, 26.7, 38.4, 0, 371, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   450, 'kg', 'manual', null, null),
  ('Butter', 'Butter', array['mantikilya', 'butter'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'g', 717, 0.9, 0.1, 81, 0.1, 0, 550, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   450, 'kg', 'manual', null, null),
  ('Margarine', 'Margarine', array['margarina', 'margarine'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'g', 717, 0.2, 0.7, 80, 0.6, 0, 800, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   150, 'kg', 'manual', null, null),
  ('Cheddar cheese', 'Cheddar cheese', array['keso', 'cheddar', 'cheddar cheese'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'g', 403, 24.9, 1.3, 33.1, 0.5, 0, 621, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   600, 'kg', 'manual', null, null),
  ('Quickmelt cheese', 'Quickmelt cheese', array['quickmelt', 'melting cheese', 'eden cheese'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'g', 330, 18, 6, 26, 3, 0, 900, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   350, 'kg', 'manual', null, null),
  ('All-purpose cream', 'All-purpose cream', array['table cream', 'all-purpose cream', 'all purpose cream'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'ml', 195, 2.8, 3.4, 20, 3.4, 0, 40, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   200, 'L', 'manual', null, null),
  ('Yogurt, plain', 'Plain yogurt', array['yogurt', 'plain yogurt'], 'Dairy', 'Eggs & Dairy', 'raw', 'pantry',
   100, 'ml', 61, 3.5, 4.7, 3.3, 4.7, 0, 46, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   180, 'L', 'manual', null, null);
