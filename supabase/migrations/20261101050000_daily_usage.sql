-- Daily limits for free accounts (Browse search, Suggest by Budget, Suggest
-- by Pantry), counted per account instead of per phone, so reinstalling or
-- another phone doesn't reset them. A day is a Philippine day (midnight in
-- Asia/Manila), the same on every device. Pro accounts (tier = 'pro') have
-- no limit. Guests have no account: their count stays on the phone.
--
-- Still a soft limit (searches read the catalog directly); this keeps the
-- count honest across devices, not the data locked.

create table public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null check (kind in ('search', 'budget', 'pantry')),
  day     date not null,
  -- New uses today (repeats and refinements don't count).
  count   integer not null default 0,
  -- Today's counted uses, by the app's signature for them: repeats are free.
  seen    text[] not null default '{}',
  -- The last use's signature, for the app's "only refines the last one".
  last    text,
  primary key (user_id, kind, day)
);

-- Read your own; writes only through count_daily_use below.
alter table public.daily_usage enable row level security;
create policy "Users read own usage" on public.daily_usage
  for select to authenticated using (auth.uid() = user_id);

-- Today's limit for a kind, for the signed-in user: null when unlimited.
-- Matches FREE_DAILY_SEARCHES / FREE_DAILY_SUGGESTIONS in the app's
-- core/pro/proContent.ts.
create function public.daily_limit(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when (select tier from public.users where id = auth.uid()) = 'pro' then null
    when p_kind = 'search' then 10
    else 5
  end;
$$;

-- Counts one use. A repeat of a use from earlier today is free, and so is
-- one the app says only refines the last (p_refines). Returns whether it's
-- allowed and how many uses are left today (null left: no limit).
create function public.count_daily_use(p_kind text, p_signature text, p_refines boolean default false)
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
  if p_kind not in ('search', 'budget', 'pantry') then
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

-- Uses left today for a kind (null: no limit).
create function public.daily_uses_left(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when public.daily_limit(p_kind) is null then null
    else greatest(
      public.daily_limit(p_kind) - coalesce(
        (select count from public.daily_usage
          where user_id = auth.uid() and kind = p_kind
            and day = (now() at time zone 'Asia/Manila')::date),
        0),
      0)
  end;
$$;

revoke execute on function public.daily_limit(text) from public, anon;
revoke execute on function public.count_daily_use(text, text, boolean) from public, anon;
revoke execute on function public.daily_uses_left(text) from public, anon;
grant execute on function public.daily_limit(text) to authenticated;
grant execute on function public.count_daily_use(text, text, boolean) to authenticated;
grant execute on function public.daily_uses_left(text) to authenticated;
