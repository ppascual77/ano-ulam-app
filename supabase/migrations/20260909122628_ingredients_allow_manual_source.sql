-- When grounding finds no confident match, existing data (if any) is kept
-- as-is and marked 'manual' rather than nulled out or left misattributed.
alter table public.ingredients drop constraint ingredients_source_check;

alter table public.ingredients add constraint ingredients_source_check
  check (source is null or source in ('FNRI', 'USDA', 'manual'));
