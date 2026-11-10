-- Free accounts get 3 Suggest by Budget and 3 Suggest by Pantry a day (was
-- 5 each); searches stay at 10, Pro stays unlimited. Matches
-- FREE_DAILY_SUGGESTIONS in the app's core/pro/proContent.ts.
create or replace function public.daily_limit(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when public.is_pro(auth.uid()) then null
    when p_kind = 'search' then 10
    else 3
  end;
$$;
