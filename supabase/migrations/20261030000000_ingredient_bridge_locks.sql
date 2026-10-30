-- Locks on an ingredient's unit bridges, so a bridge the admin has checked
-- stops getting "corrected" by the AI bridge check on every new meal.
--
-- Why: grams_per_piece is shared by every meal that uses the ingredient,
-- but the bridge check judged it against ONE recipe's wording. "1 large
-- onion" made it propose 150 g over the 110 g a "medium onion" meal was
-- built on; accepting that broke the first meal, and the next recipe
-- flagged it again. A bridge means a TYPICAL piece (a medium onion, one
-- clove); a recipe that says "large" or "small" adjusts its own line's
-- quantity, never the shared value.
--
-- - piece_verified_at: grams_per_piece + piece_label were checked.
-- - density_verified_at: grams_per_ml was checked.
-- - bridge_note: where the numbers came from ("USDA: 1 medium = 110 g",
--   "weighed").
-- A locked value can still be edited by hand, but only in the same write
-- that re-stamps its lock (the edit sheet does this), so nothing changes a
-- verified bridge by accident: not the AI bridge check, not a script.

alter table public.ingredients
  add column piece_verified_at timestamptz,
  add column density_verified_at timestamptz,
  add column bridge_note text,
  -- Nothing to verify without a value.
  add constraint ingredients_piece_lock_needs_value
    check (piece_verified_at is null or grams_per_piece is not null),
  add constraint ingredients_density_lock_needs_value
    check (density_verified_at is null or grams_per_ml is not null);

create function public.guard_locked_bridges() returns trigger
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
  return new;
end;
$$;

create trigger ingredients_guard_locked_bridges
  before update on public.ingredients
  for each row execute function public.guard_locked_bridges();
