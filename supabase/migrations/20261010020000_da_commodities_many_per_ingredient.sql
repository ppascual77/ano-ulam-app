-- An ingredient can now link to several DA commodities, e.g. "Bangus" to
-- both "Bangus, Large" and "Bangus, Medium". Each shows as its own DA price
-- source on ingredient detail, and the cheapest of all sources (DA and
-- supermarket) still sets estimated_price. 20261010000000 limited it to one.
alter table public.da_commodities drop constraint da_commodities_ingredient_id_key;

create index da_commodities_ingredient_id_idx on public.da_commodities (ingredient_id);
