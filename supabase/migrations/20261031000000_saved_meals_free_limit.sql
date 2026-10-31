-- Saved meals: free accounts keep up to 10 (was 15 for everyone), Pro is
-- unlimited (500 is only a technical cap). Matches SAVED_MEALS_LIMIT and
-- PRO_SAVED_MEALS_LIMIT in frontend/core/saved/types.ts.
--
-- Accounts already above 10 keep every save; they just can't add more until
-- they're under it.
--
-- Pro here is users.tier = 'pro'. The app's Pro is still a test switch that
-- doesn't set tier, so a test-Pro account stops at 10 here until real Pro
-- accounts exist. Before release: users can still edit their own tier (see
-- the pre-release checklist), so lock that down before relying on it.
create or replace function public.enforce_saved_meals_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int := case
    when exists (select 1 from public.users where id = new.user_id and tier = 'pro') then 500
    else 10
  end;
begin
  if (select count(*) from public.saved_meals where user_id = new.user_id) >= cap then
    raise exception 'saved meals limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
