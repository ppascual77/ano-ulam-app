-- Original recipe photo captured at import time (see import-meal-from-url's
-- JSON-LD `image` extraction). Reference-only, used to give the AI meal-photo
-- generator (generate-meal-image) a sense of the dish's real plating/style —
-- never displayed to consumers directly. `image_url` remains the actual,
-- admin-controlled displayed photo.
alter table public.meals add column reference_image_url text;
