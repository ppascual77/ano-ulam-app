-- Makes the "always per 100g" convention (docs/ingredient-data-architecture.md
-- section 20) explicit and visible in the schema, instead of an unenforced
-- assumption that nothing would catch if violated (e.g. an import that's
-- actually per-serving, not per-100g, with no column to notice the mismatch).
-- Existing rows and the current seed are already per-100g, hence the defaults.
alter table public.ingredients add column basis_amount numeric not null default 100;
alter table public.ingredients add column basis_unit text not null default 'g';
