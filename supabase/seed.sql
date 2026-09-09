-- Dev/test seed data. This first batch is 10 ingredients (matching the
-- Chicken Adobo example meal in docs/ingredient-data-architecture.md, plus
-- rice and salt) to validate the ingredients schema end-to-end before
-- building USDA grounding tooling or scaling to the full ~500.
--
-- Nutrition values here are AI-estimated placeholders (per 100g), not
-- fetched from FNRI/USDA — hence source = 'manual' and verification_status
-- = 'NEEDS_REVIEW', so this is honestly labeled as ungrounded rather than
-- pretending to be verified. A real grounding pass should upgrade these to
-- 'FNRI'/'USDA' with actual reference data where a confident match exists;
-- rows that don't get a confident match stay 'manual' rather than losing
-- their data, per the architecture doc's fallback behavior.
insert into public.ingredients (
  canonical_name, display_name, aliases, category, food_group, state,
  calories, protein, carbohydrates, fat, sugar, fiber, sodium,
  source, source_description, verification_status
) values
  ('Chicken breast, raw', 'Chicken breast', array['chicken', 'chicken breast', 'manok'], 'Poultry', 'Meat & Poultry', 'raw',
   120, 22.5, 0, 2.6, 0, 0, 65,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Soy sauce', 'Soy sauce', array['toyo', 'soya sauce'], 'Condiments & Sauces', 'Condiments', null,
   53, 8, 4.9, 0.1, 0.4, 0.8, 5500,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Vinegar, white', 'White vinegar', array['suka', 'white vinegar', 'cane vinegar'], 'Condiments & Sauces', 'Condiments', null,
   18, 0, 0.9, 0, 0.4, 0, 2,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Garlic', 'Garlic', array['bawang', 'garlic cloves', 'minced garlic'], 'Aromatics', 'Vegetables', 'raw',
   149, 6.4, 33, 0.5, 1, 2.1, 17,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Onion', 'Onion', array['sibuyas', 'yellow onion', 'white onion'], 'Aromatics', 'Vegetables', 'raw',
   40, 1.1, 9.3, 0.1, 4.2, 1.7, 4,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Bay leaf', 'Bay leaf', array['laurel', 'dahon ng laurel', 'bay leaves'], 'Herbs', 'Herbs & Spices', null,
   313, 7.6, 75, 8.4, 0, 26, 23,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Black pepper, ground', 'Ground black pepper', array['paminta', 'ground pepper', 'pepper'], 'Spices', 'Herbs & Spices', null,
   251, 10.4, 64, 3.3, 0.6, 25, 20,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Cooking oil', 'Cooking oil', array['vegetable oil', 'mantika', 'canola oil'], 'Oils', 'Fats & Oils', null,
   884, 0, 0, 100, 0, 0, 0,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Rice, white, raw', 'White rice', array['bigas', 'white rice', 'jasmine rice'], 'Grains', 'Grains & Cereals', 'raw',
   365, 7.1, 80, 0.7, 0.1, 1.3, 5,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW'),
  ('Salt', 'Salt', array['asin', 'table salt', 'iodized salt'], 'Seasonings', 'Condiments', null,
   0, 0, 0, 0, 0, 0, 38758,
   'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW');
