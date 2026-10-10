-- DA Daily Price Index (Admin → DA Daily Prices, edge function
-- ingest-da-daily-prices). DA publishes one PDF per day with the
-- "prevailing" (mean) retail price of ~200 agri-fishery commodities across
-- 35 NCR wet markets. These are the first rows of the price_observations
-- history docs/ingredient-data-architecture.md section 11 describes.
--
-- DA commodities are kept apart from `ingredients` on purpose: DA lists
-- variants ("Chicken Wing, Local Bounty Fresh", "Garlic, Imported") that
-- would clutter the canonical table. An admin links each ingredient to at
-- most one commodity (its price reference), once; every later daily upload
-- then refreshes that ingredient's estimated_price.

create table public.da_commodities (
  id uuid primary key default gen_random_uuid(),
  -- As printed in the PDF, e.g. "Pork Picnic Shoulder (Kasim), Local".
  commodity text not null,
  -- '' rather than null when the PDF leaves it blank, so the unique key
  -- below (and upsert's on_conflict) treats two blanks as the same row.
  specification text not null default '',
  -- The PDF section header, e.g. "PORK MEAT PRODUCTS".
  section text,
  -- What one DA price is for. The PDF says cooking oil is per liter, but
  -- "350 ml/bottle 39.98" vs "1 Liter/bottle 102.18" shows it's per bottle.
  unit text not null check (unit in ('kg', 'piece', 'bottle')),
  -- Liters per bottle (oil) or grams per piece (eggs), read from the
  -- specification, so a price can be converted to ₱/L or ₱/kg.
  unit_size numeric,
  ingredient_id uuid unique references public.ingredients (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (commodity, specification)
);

create table public.daily_prices (
  id uuid primary key default gen_random_uuid(),
  da_commodity_id uuid not null references public.da_commodities (id) on delete cascade,
  price_date date not null,
  -- ₱ per da_commodities.unit. "n/a" rows aren't stored at all.
  price numeric(10, 2) not null check (price > 0),
  source_url text,
  created_at timestamptz not null default now(),
  -- Re-uploading a day (or DA's "Revised" PDF for it) overwrites, never duplicates.
  unique (da_commodity_id, price_date)
);

create index daily_prices_date_idx on public.daily_prices (price_date desc);

alter table public.ingredients drop constraint ingredients_price_source_check;
alter table public.ingredients add constraint ingredients_price_source_check
  check (price_source in ('manual', 'price_watch', 'supermarket', 'da'));

alter table public.da_commodities enable row level security;
alter table public.daily_prices enable row level security;

create policy "Anyone can view DA commodities" on public.da_commodities for select using (true);
create policy "Anyone can view daily prices" on public.daily_prices for select using (true);

-- TEMP, same as the ingredients write policies: fine for the solo-admin
-- phase, must be restricted to admins before public release.
create policy "TEMP: anyone can insert DA commodities" on public.da_commodities for insert with check (true);
create policy "TEMP: anyone can update DA commodities" on public.da_commodities for update using (true);
create policy "TEMP: anyone can insert daily prices" on public.daily_prices for insert with check (true);
create policy "TEMP: anyone can update daily prices" on public.daily_prices for update using (true);
