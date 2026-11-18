-- Cook mode's narration is Pro, with a daily taste: free accounts get 1
-- narrated meal a day (the same meal again that day is free), Pro has no
-- limit. A new daily_usage kind, 'narration', counted like the others.
-- Matches FREE_DAILY_NARRATIONS in the app's core/pro/proContent.ts (guests
-- get the same 1, counted on the phone).

alter table public.daily_usage drop constraint if exists daily_usage_kind_check;
alter table public.daily_usage add constraint daily_usage_kind_check
  check (kind in ('search', 'budget', 'pantry', 'narration'));

create or replace function public.daily_limit(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when public.is_pro(auth.uid()) then null
    when p_kind = 'search' then 10
    when p_kind = 'narration' then 1
    else 3
  end;
$$;

-- Same as 20261101050000_daily_usage.sql, with 'narration' accepted.
create or replace function public.count_daily_use(p_kind text, p_signature text, p_refines boolean default false)
returns table (allowed boolean, uses_left integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_day   date := (now() at time zone 'Asia/Manila')::date;
  v_limit integer := public.daily_limit(p_kind);
  v_row   public.daily_usage;
  v_free  boolean;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_kind not in ('search', 'budget', 'pantry', 'narration') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  insert into public.daily_usage (user_id, kind, day) values (v_user, p_kind, v_day)
    on conflict do nothing;
  select * into v_row from public.daily_usage
    where user_id = v_user and kind = p_kind and day = v_day
    for update;

  v_free := p_signature = any (v_row.seen) or (p_refines and v_row.last is not null);
  if not v_free and v_limit is not null and v_row.count >= v_limit then
    return query select false, 0;
    return;
  end if;

  update public.daily_usage set
    count = case when v_free then count else count + 1 end,
    seen  = case when p_signature = any (seen) then seen else seen || p_signature end,
    last  = p_signature
  where user_id = v_user and kind = p_kind and day = v_day
  returning * into v_row;

  return query select true, case when v_limit is null then null else greatest(v_limit - v_row.count, 0) end;
end $$;
