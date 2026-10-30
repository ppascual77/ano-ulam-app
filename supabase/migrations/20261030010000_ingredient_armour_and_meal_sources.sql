-- Armour for an ingredient's macros and price, the same idea as the bridge
-- locks (20261030000000): once the admin has checked a value, checks treat
-- it as a fact instead of re-judging it on every new meal. Used by the
-- /seed-meal Claude Code skill (each ingredient is approved line by line)
-- and the Manage Ingredients edit sheet.
--
-- - macros_verified_at: calories/protein/carbs/fat/sugar/fiber/sodium and
--   their basis were checked. Locked like the bridges: the DB rejects a
--   change unless the same write re-stamps it (the edit sheet does).
--   Batch USDA/FNRI grounding skips these rows. Separate from
--   last_verified_at, which USDA grounding sets on its own.
-- - price_verified_at: the price SOURCES and unit were checked. Not locked:
--   the price itself is the cheapest of the linked sources and moves with
--   DA refreshes, which must keep working. It only tells checks not to
--   question where the price comes from.

alter table public.ingredients
  add column macros_verified_at timestamptz,
  add column price_verified_at timestamptz,
  add constraint ingredients_macros_lock_needs_value
    check (macros_verified_at is null or calories is not null),
  add constraint ingredients_price_check_needs_value
    check (price_verified_at is null or estimated_price is not null);

create or replace function public.guard_locked_bridges() returns trigger
language plpgsql as $$
begin
  if old.piece_verified_at is not null
     and new.piece_verified_at is not distinct from old.piece_verified_at
     and (new.grams_per_piece is distinct from old.grams_per_piece
          or new.piece_label is distinct from old.piece_label) then
    raise exception 'Piece weight for "%" is verified. Unlock it or re-verify it in the same update to change it.', old.canonical_name;
  end if;
  if old.density_verified_at is not null
     and new.density_verified_at is not distinct from old.density_verified_at
     and new.grams_per_ml is distinct from old.grams_per_ml then
    raise exception 'Grams per ml for "%" is verified. Unlock it or re-verify it in the same update to change it.', old.canonical_name;
  end if;
  if old.macros_verified_at is not null
     and new.macros_verified_at is not distinct from old.macros_verified_at
     and (new.calories is distinct from old.calories
          or new.protein is distinct from old.protein
          or new.carbohydrates is distinct from old.carbohydrates
          or new.fat is distinct from old.fat
          or new.sugar is distinct from old.sugar
          or new.fiber is distinct from old.fiber
          or new.sodium is distinct from old.sodium
          or new.basis_amount is distinct from old.basis_amount
          or new.basis_unit is distinct from old.basis_unit) then
    raise exception 'Macros for "%" are verified. Unlock them or re-verify them in the same update to change them.', old.canonical_name;
  end if;
  return new;
end;
$$;

-- Where a seeded meal came from. Admin-only (no policies, so only the
-- service role reads or writes it): users never see it. Kept as proof of
-- what was taken (facts: ingredients, method) vs written fresh, and so
-- /seed-meal can say "you already imported this link".
create table public.meal_sources (
  meal_id     uuid primary key references public.meals(id) on delete cascade,
  url         text not null,
  imported_at timestamptz not null default now()
);

create index meal_sources_url on public.meal_sources (url);

alter table public.meal_sources enable row level security;
