-- Weekly "new meals" push (Sundays 9:00 PH): the meals published in the last
-- 7 days, up to 5 named, to everyone with notifications on and this kind on
-- (Settings → Notifications → New meals). Nothing that week: no push.

-- ---- when a meal went live ----------------------------------------------------
-- created_at is when a user recipe was submitted, not approved, and
-- updated_at moves on every edit, so a meal gets its own "published at":
-- stamped when it becomes approved (inserted as approved too, e.g. the
-- /seed-meal skill), kept through later edits, cleared if it stops being
-- approved, and never set by hand (a poster editing their pending recipe).
alter table public.meals add column published_at timestamptz;

update public.meals set published_at = coalesce(created_at, now())
  where status = 'approved' and published_at is null;

create or replace function public.stamp_meal_published() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' then
    new.published_at := case
      when tg_op = 'UPDATE' and old.status = 'approved' then old.published_at
      else now()
    end;
  else
    new.published_at := null;
  end if;
  return new;
end $$;

create trigger meals_stamp_published
  before insert or update on public.meals
  for each row execute function public.stamp_meal_published();

-- ---- the setting --------------------------------------------------------------
alter table public.users add column push_new_meals boolean not null default true;
grant update (push_new_meals) on public.users to authenticated;

-- ---- the weekly push ------------------------------------------------------------
alter table public.price_alert_log drop constraint price_alert_log_kind_check;
alter table public.price_alert_log add constraint price_alert_log_kind_check
  check (kind = any (array['daily', 'weekly', 'new_meals']));

create or replace function public.send_weekly_new_meals() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_total int;
  v_names text;
  v_title text;
  v_messages jsonb;
  v_count int;
begin
  if exists (select 1 from public.price_alert_log where kind = 'new_meals' and price_date >= v_today - 6) then
    return 'already sent this week';
  end if;

  select count(*) into v_total
    from public.meals
    where status = 'approved' and archived_at is null and published_at >= now() - interval '7 days';
  if v_total = 0 then
    insert into public.price_alert_log (kind, price_date) values ('new_meals', v_today);
    return 'no new meals this week';
  end if;

  -- Up to 5 names, newest first.
  select string_agg(name, ', ' order by published_at desc) into v_names
    from (
      select name, published_at from public.meals
      where status = 'approved' and archived_at is null and published_at >= now() - interval '7 days'
      order by published_at desc
      limit 5
    ) m;
  v_title := case when v_total = 1 then 'A new meal this week 🍲' else format('%s new meals this week 🍲', v_total) end;

  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', v_title,
      'body', v_names || case when v_total > 5 then ' and more.' else '.' end || ' See what to cook.',
      'sound', 'default',
      'data', jsonb_build_object('type', 'new_meals')
    )), count(*)
    into v_messages, v_count
    from public.push_tokens t
    join public.users u on u.id = t.user_id
    where u.push_enabled and u.push_new_meals;

  perform public.send_expo_push(v_messages);
  insert into public.price_alert_log (kind, price_date, recipients) values ('new_meals', v_today, coalesce(v_count, 0));
  return format('%s new meals to %s phones', v_total, coalesce(v_count, 0));
end $$;

-- Server-only, like the other push senders.
revoke execute on function public.send_weekly_new_meals() from public, anon, authenticated;

-- Sundays 01:00 UTC = 09:00 PH.
select cron.schedule('weekly-new-meals', '0 1 * * 0', 'select public.send_weekly_new_meals()');
