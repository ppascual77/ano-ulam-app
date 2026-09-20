-- Batch 14/~16: Oils & fats (15 items). Same treatment as prior batches —
-- AI-estimated placeholders, honestly tagged source='manual',
-- verification_status='NEEDS_REVIEW', so the "Ground from USDA" tool has
-- real candidates to upgrade against, and any item it can't confidently
-- match still has usable (if approximate) data rather than nulls
-- blocking the meal-nutrition pipeline.
--
-- Reuses category='Oils' / food_group='Fats & Oils' / state=null /
-- basis_unit='g' from the existing 'Cooking oil' row (batch 1). That row
-- already aliases 'vegetable oil' and 'canola oil', so this batch adds
-- only genuinely distinct oil/fat types rather than duplicating those.
insert into public.ingredients (
  canonical_name, display_name, aliases, category, food_group, state, role,
  basis_amount, basis_unit, calories, protein, carbohydrates, fat, sugar, fiber, sodium,
  source, source_description, verification_status,
  estimated_price, estimated_price_unit, price_source,
  grams_per_piece, piece_label
) values
  ('Coconut oil', 'Coconut oil', array['coconut oil', 'niyog oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 862, 0, 0, 99.06, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   250, 'kg', 'manual', null, null),
  ('Palm oil', 'Palm oil', array['palm oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   90, 'kg', 'manual', null, null),
  ('Corn oil', 'Corn oil', array['corn oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   150, 'kg', 'manual', null, null),
  ('Olive oil', 'Olive oil', array['olive oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 2, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   350, 'kg', 'manual', null, null),
  ('Olive oil, extra virgin', 'Extra virgin olive oil', array['extra virgin olive oil', 'evoo'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 2, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   500, 'kg', 'manual', null, null),
  ('Sesame oil', 'Sesame oil', array['sesame oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   400, 'kg', 'manual', null, null),
  ('Peanut oil', 'Peanut oil', array['peanut oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   200, 'kg', 'manual', null, null),
  ('Sunflower oil', 'Sunflower oil', array['sunflower oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   150, 'kg', 'manual', null, null),
  ('Soybean oil', 'Soybean oil', array['soybean oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   120, 'kg', 'manual', null, null),
  ('Lard', 'Lard', array['lard', 'mantika ng baboy', 'pork fat, rendered'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 902, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   200, 'kg', 'manual', null, null),
  ('Shortening, vegetable', 'Vegetable shortening', array['shortening', 'vegetable shortening'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   150, 'kg', 'manual', null, null),
  ('Ghee', 'Ghee', array['ghee', 'clarified butter'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 900, 0.3, 0, 99.8, 0, 0, 2, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   600, 'kg', 'manual', null, null),
  ('Annatto oil', 'Annatto oil (achuete oil)', array['achuete oil', 'annatto oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 884, 0, 0, 100, 0, 0, 0, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   200, 'kg', 'manual', null, null),
  ('Garlic oil', 'Garlic oil', array['garlic oil', 'garlic-infused oil'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 880, 0.2, 0.5, 99, 0, 0, 5, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   250, 'kg', 'manual', null, null),
  ('Chicken fat, rendered', 'Rendered chicken fat', array['chicken fat', 'schmaltz'], 'Oils', 'Fats & Oils', null, 'pantry',
   100, 'g', 900, 0, 0, 100, 0, 0, 15, 'manual', 'AI-estimated placeholder, pending FNRI/USDA grounding', 'NEEDS_REVIEW',
   150, 'kg', 'manual', null, null);
