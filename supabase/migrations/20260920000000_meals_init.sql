-- Meals + meal_ingredients: the second domain built on top of the canonical
-- ingredient foundation (docs/ingredient-data-architecture.md). A meal's
-- nutrition/price is no longer hand-typed per recipe (the old mock data's
-- approach — see frontend/core/meals/mocks/meals.ts) — it's computed by
-- scaling each linked ingredient's real per-100g data by the quantity used,
-- then cached on the meal row (see `ingredients_synced_at` below) rather
-- than recomputed on every read.
--
-- v1 scope (confirmed decision): read-only catalog, no submission/
-- moderation workflow yet — no `status`/`rejection_reason`/`poster_id`.
-- `liked_by_me` isn't a column here; it'll come from a separate
-- `meal_likes` table once a likes feature is actually built, not before.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  budget_range text,

  -- Cached aggregate totals — the sum of this meal's "main" ingredients
  -- (see meal_ingredients.ingredient_id -> ingredients.role), scaled to
  -- actual quantity used. Recomputed by an explicit action (the same
  -- "nothing auto-applies" principle as ingredient USDA grounding), not a
  -- live trigger — ingredients_synced_at records when that last happened
  -- so a stale meal (e.g. after one of its ingredients got re-grounded)
  -- can be flagged for review rather than silently drifting.
  price numeric,
  calories numeric,
  protein numeric,
  carbohydrates numeric,
  fat numeric,
  ingredients_synced_at timestamptz,

  prep_time integer,
  total_time integer,
  difficulty text,
  protein_type text,
  serving_size integer not null default 1,

  -- One step per array element — steps have no independent identity
  -- (not reorderable/shared across meals, always fetched with the meal),
  -- so a plain array keeps this simple. Matches the old mock shape's
  -- `procedure: string[]` already.
  procedure text[] not null default '{}',

  restaurant text,
  source text,
  source_type text,
  image_url text,
  image_attribution text,

  allergens text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  tags text[] not null default '{}',

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meals_difficulty_check
    check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  constraint meals_source_type_check
    check (source_type is null or source_type in ('official', 'estimated', 'ai_estimated'))
);

create index meals_name_idx on public.meals (name);
create index meals_category_idx on public.meals (category);

-- Every meal ingredient references a real canonical ingredient row — no
-- per-meal ad-hoc macro guesses. This is deliberately stricter than the
-- reference web app's "Keep AI estimate" escape hatch (which existed
-- because an LLM was inventing ingredient names with no DB guarantee); an
-- admin building a meal from the ~500-item canonical table can always
-- resolve a real ingredient first (or add one via the USDA-backed create
-- flow), so there's no legitimate case here for an unlinked ingredient.
-- `quantity_amount`/`quantity_unit` are nullable for "to taste"-style
-- entries (a real ingredient row, e.g. Salt, with no meaningful quantity)
-- — those contribute 0 to the meal's computed totals.
create table public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,

  quantity_amount numeric,
  quantity_unit text,
  display_text text not null,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),

  constraint meal_ingredients_quantity_unit_check
    check (quantity_unit is null or quantity_unit in ('g', 'kg', 'ml', 'L', 'piece'))
);

create index meal_ingredients_meal_id_idx on public.meal_ingredients (meal_id);
create index meal_ingredients_ingredient_id_idx on public.meal_ingredients (ingredient_id);
