-- Price Watch pushes (the paywall's "Price drop alerts" and "Weekly savings,
-- in pesos"), sent from the database on a schedule (pg_cron) through the
-- recipe push's setup (push_tokens, Expo's push service via pg_net):
--
-- - Daily price drop alert (Pro): the biggest drop of the newest DA day,
--   the same rule as Home's price line and Price Watch (latest price vs the
--   last one at least 7 days before), only when it's a real drop (5% or
--   more) and not an item alerted in the last 3 days. Checked at 11:30 and
--   16:30 PH (after the DA import job's 10:00 and 16:00 runs); sent at most
--   once per DA day.
-- - Weekly best buys (Saturday 08:00 PH): Pro gets the week's 3 biggest
--   drops in pesos; Free gets the biggest one and a line about Pro.
--
-- Both respect users.push_enabled (the general switch) and their own
-- switches below. Tapping either opens Price Watch.

create extension if not exists pg_cron;

-- ---- Settings -------------------------------------------------------------------

alter table public.users
  add column push_price_alerts boolean not null default true,
  add column push_weekly_digest boolean not null default true;
grant update (push_price_alerts, push_weekly_digest) on public.users to authenticated;

-- ---- What was sent (dedup; server only) ---------------------------------------------

create table public.price_alert_log (
  id bigserial primary key,
  kind text not null check (kind in ('daily', 'weekly')),
  -- The DA day the alert was about.
  price_date date not null,
  da_commodity_id uuid references public.da_commodities(id) on delete set null,
  recipients int not null default 0,
  sent_at timestamptz not null default now()
);
create index price_alert_log_kind_date_idx on public.price_alert_log (kind, price_date);
alter table public.price_alert_log enable row level security;
revoke all on public.price_alert_log from anon, authenticated;

-- ---- Drops, as Price Watch computes them -------------------------------------------

-- A push-friendly name: before the first comma ("Tilapia", like Home's
-- line), with the animal put back where DA's section carries it ("Breast
-- (Pecho)" under CHICKEN → "Chicken Breast (Pecho)").
create function public.da_short_name(p_commodity text, p_section text) returns text
language sql immutable as $$
  select case
    when animal is not null and position(lower(animal) in lower(base)) = 0 then animal || ' ' || base
    else base
  end
  from (
    select trim(split_part(p_commodity, ',', 1)) as base,
      case
        when p_section like 'CHICKEN%' then 'Chicken'
        when p_section like 'PORK%' then 'Pork'
        when p_section like 'BEEF%' then 'Beef'
        when p_section = 'BUFFALO' then 'Carabeef'
        when p_section = 'DUCK' then 'Duck'
      end as animal
  ) n
$$;

-- Every commodity priced on p_on, with its price 7+ days before and the
-- change (pct: -12.3 = 12.3% cheaper). Only ones Price Watch shows.
create function public.da_week_changes(p_on date)
returns table (da_commodity_id uuid, name text, unit text, latest numeric, week_ago numeric, pct numeric)
language sql stable set search_path = public as $$
  with today as (
    select c.id, c.commodity, c.section, c.unit, dp.price
    from public.da_commodities c
    join public.daily_prices dp on dp.da_commodity_id = c.id and dp.price_date = p_on
    where c.latest_price is not null
  ), before as (
    select distinct on (t.id) t.id, dp.price
    from today t
    join public.daily_prices dp on dp.da_commodity_id = t.id and dp.price_date <= p_on - 7
    order by t.id, dp.price_date desc
  )
  select t.id, public.da_short_name(t.commodity, t.section), t.unit, t.price, b.price,
    round((t.price - b.price) / b.price * 100, 1)
  from today t join before b on b.id = t.id
  where b.price > 0
$$;

-- "/kg", "/pc", "/bottle".
create function public.da_per_unit(p_unit text) returns text
language sql immutable as $$
  select case p_unit when 'kg' then '/kg' when 'piece' then '/pc' else '/' || p_unit end
$$;

-- ---- Sending ----------------------------------------------------------------------

-- Expo takes up to 100 messages per request.
create function public.send_expo_push(p_messages jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_chunk jsonb;
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then
    return;
  end if;
  for v_chunk in
    select jsonb_agg(m) from (
      select m, (row_number() over () - 1) / 100 as grp from jsonb_array_elements(p_messages) m
    ) x group by grp
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_chunk,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end loop;
end $$;

-- The 5% bar for a push (Home's line shows 3% and up; a push needs more).
create function public.price_alert_min_drop() returns numeric
language sql immutable as $$ select -5.0 $$;

create function public.send_daily_price_alert() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_day date;
  v_pick record;
  v_messages jsonb;
  v_count int;
begin
  select max(price_date) into v_day from public.daily_prices;
  if v_day is null then
    return 'no prices';
  end if;
  -- Once per DA day (the 16:30 run catches a day the 11:30 run didn't have).
  if exists (select 1 from public.price_alert_log where kind = 'daily' and price_date >= v_day) then
    return 'already handled ' || v_day;
  end if;

  select * into v_pick
  from public.da_week_changes(v_day) d
  where d.pct <= public.price_alert_min_drop()
    and not exists (
      select 1 from public.price_alert_log l
      where l.kind = 'daily' and l.da_commodity_id = d.da_commodity_id and l.price_date > v_day - 3
    )
  order by d.pct asc
  limit 1;

  if not found then
    insert into public.price_alert_log (kind, price_date) values ('daily', v_day);
    return 'no real drop on ' || v_day;
  end if;

  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', format('🔻 %s is %s%% cheaper', v_pick.name, abs(round(v_pick.pct))),
      'body', format('Now ₱%s%s, down from ₱%s a week ago at NCR markets.',
        round(v_pick.latest), public.da_per_unit(v_pick.unit), round(v_pick.week_ago)),
      'sound', 'default',
      'data', jsonb_build_object('type', 'price_drop', 'commodityId', v_pick.da_commodity_id)
    )), count(*)
    into v_messages, v_count
    from public.push_tokens t
    join public.users u on u.id = t.user_id
    where u.push_enabled and u.push_price_alerts and public.is_pro(u.id);

  perform public.send_expo_push(v_messages);
  insert into public.price_alert_log (kind, price_date, da_commodity_id, recipients)
    values ('daily', v_day, v_pick.da_commodity_id, coalesce(v_count, 0));
  return format('%s %s%% to %s phones', v_pick.name, v_pick.pct, coalesce(v_count, 0));
end $$;

create function public.send_weekly_best_buys() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_day date;
  v_top jsonb;
  v_first jsonb;
  v_pro_body text;
  v_free_body text;
  v_messages jsonb;
  v_count int;
begin
  select max(price_date) into v_day from public.daily_prices;
  if v_day is null then
    return 'no prices';
  end if;
  if exists (select 1 from public.price_alert_log where kind = 'weekly' and price_date >= v_day - 6) then
    return 'already sent this week';
  end if;

  select jsonb_agg(to_jsonb(d) order by d.pct) into v_top
  from (
    select * from public.da_week_changes(v_day)
    where pct <= public.price_alert_min_drop()
    order by pct asc
    limit 3
  ) d;
  if v_top is null then
    insert into public.price_alert_log (kind, price_date) values ('weekly', v_day);
    return 'no real drops this week';
  end if;
  v_first := v_top -> 0;

  -- Pro: in pesos. "Onion ₱28/kg less · Tilapia ₱19/kg less · …"
  select string_agg(format('%s ₱%s%s less', e ->> 'name',
      round((e ->> 'week_ago')::numeric - (e ->> 'latest')::numeric),
      public.da_per_unit(e ->> 'unit')), ' · ')
    into v_pro_body
    from jsonb_array_elements(v_top) e;
  v_pro_body := v_pro_body || ' than last week at NCR markets.';
  v_free_body := format('%s is %s%% cheaper than last week. Get alerts the day prices drop with Pro.',
    v_first ->> 'name', abs(round((v_first ->> 'pct')::numeric)));

  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', 'This week''s best buys 🛒',
      'body', case when public.is_pro(u.id) then v_pro_body else v_free_body end,
      'sound', 'default',
      'data', jsonb_build_object('type', 'weekly_best_buys')
    )), count(*)
    into v_messages, v_count
    from public.push_tokens t
    join public.users u on u.id = t.user_id
    where u.push_enabled and u.push_weekly_digest;

  perform public.send_expo_push(v_messages);
  insert into public.price_alert_log (kind, price_date, da_commodity_id, recipients)
    values ('weekly', v_day, (v_first ->> 'da_commodity_id')::uuid, coalesce(v_count, 0));
  return format('%s drops to %s phones', jsonb_array_length(v_top), coalesce(v_count, 0));
end $$;

-- Only the schedule runs these.
revoke execute on function public.send_expo_push(jsonb) from public, anon, authenticated;
revoke execute on function public.send_daily_price_alert() from public, anon, authenticated;
revoke execute on function public.send_weekly_best_buys() from public, anon, authenticated;

-- ---- Schedule (UTC; PH is UTC+8) --------------------------------------------------

select cron.schedule('daily-price-drop-alert', '30 3,8 * * *', 'select public.send_daily_price_alert()');
select cron.schedule('weekly-best-buys', '0 0 * * 6', 'select public.send_weekly_best_buys()');
