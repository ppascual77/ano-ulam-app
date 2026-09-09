-- Canonical ingredient foundation. See docs/ingredient-data-architecture.md
-- for the full architecture and reasoning behind these decisions:
--   - Cooking state (raw/cooked/fried) is part of canonical identity, not a
--     variant of one ingredient — "Chicken breast, raw" and "Chicken breast,
--     cooked" are separate rows, since cooking genuinely changes nutrition
--     (unlike e.g. "garlic" vs. "minced garlic", which are the same food).
--   - All nutrition values are normalized to per-100g at data-entry time,
--     even if the source reported per-100mL — one formula everywhere:
--     nutrient_amount = (grams_used / 100) * nutrient_per_100g.
--   - Unit conversion is split into universal unit math (1 L = 1000 mL, etc.
--     — ingredient-independent, lives in app code) and the ingredient-
--     specific bridge from volume/count into weight (grams_per_ml,
--     grams_per_piece — the only part that actually depends on what the
--     ingredient is).
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  display_name text,
  aliases text[] not null default '{}',
  category text,
  food_group text,
  state text,

  grams_per_ml numeric,
  grams_per_piece numeric,
  piece_label text,

  calories numeric,
  protein numeric,
  carbohydrates numeric,
  fat numeric,
  sugar numeric,
  fiber numeric,
  sodium numeric,

  source text,
  source_ref_id text,
  source_description text,
  match_type text,
  verification_status text not null default 'UNRESOLVED',
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ingredients_source_check
    check (source is null or source in ('FNRI', 'USDA')),
  constraint ingredients_match_type_check
    check (match_type is null or match_type in ('exact', 'approximate')),
  constraint ingredients_verification_status_check
    check (verification_status in ('VERIFIED', 'HIGH_CONFIDENCE', 'NEEDS_REVIEW', 'UNRESOLVED'))
);

create index ingredients_canonical_name_idx on public.ingredients (canonical_name);
create index ingredients_aliases_idx on public.ingredients using gin (aliases);
