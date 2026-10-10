-- A DA price is now one of an ingredient's price sources, shown next to the
-- supermarket listings (ingredient detail → Price source), and the cheapest
-- source sets estimated_price. Reading "latest price per commodity" from
-- daily_prices needs a per-parent order+limit inside the meal query's
-- nested embed, so the latest price is kept on the commodity instead.
--
-- A trigger keeps it current, and only ever moves it forward: saving an
-- older day's PDF fills in history without rolling the price back.

alter table public.da_commodities add column latest_price numeric(10, 2);
alter table public.da_commodities add column latest_price_date date;

create function public.da_commodities_track_latest_price()
returns trigger
language plpgsql
as $$
begin
  update public.da_commodities
  set latest_price = new.price, latest_price_date = new.price_date
  where id = new.da_commodity_id
    and (latest_price_date is null or latest_price_date <= new.price_date);
  return new;
end;
$$;

create trigger daily_prices_track_latest_price
  after insert or update on public.daily_prices
  for each row execute function public.da_commodities_track_latest_price();

-- Rows saved before this migration.
update public.da_commodities c
set latest_price = p.price, latest_price_date = p.price_date
from (
  select distinct on (da_commodity_id) da_commodity_id, price, price_date
  from public.daily_prices
  order by da_commodity_id, price_date desc
) p
where p.da_commodity_id = c.id;
