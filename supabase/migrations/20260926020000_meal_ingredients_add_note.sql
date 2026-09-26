-- General-purpose annotation shown to every viewer (not just admin) when
-- the counted quantity differs from what the recipe states in display_text
-- and needs a short explanation — e.g. bulk deep-frying oil where only a
-- fraction is actually absorbed. Not oil-specific; reusable for any other
-- "counted amount differs from what's stated, here's why" case.
alter table public.meal_ingredients add column note text;
