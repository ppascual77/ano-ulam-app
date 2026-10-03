-- Ground Prices can now average several supermarket listings into one
-- estimated_price. price_source_url/price_source_label hold a single source,
-- so every listing that went into the average is kept here instead:
--   [{ "store", "productTitle", "packPrice", "packSize", "packUnit",
--      "url", "pricePerUnit", "unit" }, ...]
-- price_source_url stays as the first (highest-confidence) source's link
-- and price_source_label as a one-line summary, for quick display.
alter table public.ingredients add column price_sources jsonb;
