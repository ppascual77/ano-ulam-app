-- Dev/test seed data. This first batch is 10 ingredients (matching the
-- Chicken Adobo example meal in docs/ingredient-data-architecture.md, plus
-- rice and salt) to validate the ingredients schema end-to-end before
-- building USDA grounding tooling or scaling to the full ~500.
--
-- Nutrition (per 100g, basis_amount/basis_unit), price, and the
-- grams_per_ml/grams_per_piece unit-conversion bridges are all AI-estimated
-- placeholders, not fetched from FNRI/USDA or any real market/reference
-- data — hence source = 'manual', verification_status = 'NEEDS_REVIEW', and
-- price_source = 'manual'. Honestly labeled as ungrounded rather than
-- pretending to be verified; a real grounding pass (nutrition) or Price
-- Watch integration (price) should upgrade those two later where a
-- confident match exists. No separate provenance tracking for the
-- conversion bridges — no grounding pipeline is planned for those, they're
-- expected to stay manual/cooking-reference values long-term.
insert into public.ingredients (
  canonical_name, display_name, aliases, category, food_group, state, role,
  basis_amount, basis_unit, calories, protein, carbohydrates, fat, sugar, fiber, sodium,
  source, source_description, verification_status,
  estimated_price, estimated_price_unit, price_source,
  grams_per_ml, grams_per_piece, piece_label
) values
  ('Chicken breast, raw', 'Chicken breast', array['chicken', 'chicken breast', 'manok'], 'Poultry', 'Meat & Poultry', 'raw', 'main',
   100, 'g', 120, 22.5, 0, 2.6, 0, 0, 65,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   220, 'kg', 'manual',
   null, 150, 'medium breast'),
  ('Soy sauce', 'Soy sauce', array['toyo', 'soya sauce'], 'Condiments & Sauces', 'Condiments', null, 'pantry',
   100, 'g', 53, 8, 4.9, 0.1, 0.4, 0.8, 5500,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   90, 'L', 'manual',
   1.15, null, null),
  ('Vinegar, white', 'White vinegar', array['suka', 'white vinegar', 'cane vinegar'], 'Condiments & Sauces', 'Condiments', null, 'pantry',
   100, 'g', 18, 0, 0.9, 0, 0.4, 0, 2,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   70, 'L', 'manual',
   1.01, null, null),
  ('Garlic', 'Garlic', array['bawang', 'garlic cloves', 'minced garlic'], 'Aromatics', 'Vegetables', 'raw', 'pantry',
   100, 'g', 149, 6.4, 33, 0.5, 1, 2.1, 17,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   90, 'kg', 'manual',
   null, 3, 'clove'),
  ('Onion', 'Onion', array['sibuyas', 'yellow onion', 'white onion'], 'Aromatics', 'Vegetables', 'raw', 'pantry',
   100, 'g', 40, 1.1, 9.3, 0.1, 4.2, 1.7, 4,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   80, 'kg', 'manual',
   null, 110, 'medium onion'),
  ('Bay leaf', 'Bay leaf', array['laurel', 'dahon ng laurel', 'bay leaves'], 'Herbs', 'Herbs & Spices', null, 'pantry',
   100, 'g', 313, 7.6, 75, 8.4, 0, 26, 23,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   15, 'pack', 'manual',
   null, 0.1, 'leaf'),
  ('Black pepper, ground', 'Ground black pepper', array['paminta', 'ground pepper', 'pepper'], 'Spices', 'Herbs & Spices', null, 'pantry',
   100, 'g', 251, 10.4, 64, 3.3, 0.6, 25, 20,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   25, 'pack', 'manual',
   0.55, null, null),
  ('Cooking oil', 'Cooking oil', array['vegetable oil', 'mantika', 'canola oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   95, 'L', 'manual',
   0.92, null, null),
  ('Rice, white, raw', 'White rice', array['bigas', 'white rice', 'jasmine rice'], 'Grains', 'Grains & Cereals', 'raw', 'pantry',
   100, 'g', 365, 7.1, 80, 0.7, 0.1, 1.3, 5,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   55, 'kg', 'manual',
   0.85, null, null),
  ('Salt', 'Salt', array['asin', 'table salt', 'iodized salt'], 'Seasonings', 'Condiments', null, 'pantry',
   100, 'g', 0, 0, 0, 0, 0, 0, 38758,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   25, 'kg', 'manual',
   1.2, null, null);
