-- Pro in the database. Until now only the app knew who's Pro (RevenueCat);
-- the database still read users.tier, which nothing set and anyone could
-- edit on their own row. Now:
--
-- - users.pro_until: the App Store subscription's end, written only by the
--   revenuecat-webhook edge function (service role).
-- - users.pro_reward_until: earned Pro (Pro rewards below), written only by
--   the reward triggers.
-- - public.is_pro(uid): either one still running. The saved-meals limit and
--   the daily limits use it instead of tier.
-- - Users can update only their own profile fields (name, avatar, bio,
--   preferences, settings), never Pro, rewards or tier.
--
-- tier stays (unused) for now; nothing should read it.

alter table public.users
  add column pro_until timestamptz,
  add column pro_reward_until timestamptz;

create function public.is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = p_user
      and (pro_until > now() or pro_reward_until > now())
  );
$$;
revoke execute on function public.is_pro(uuid) from public, anon;
grant execute on function public.is_pro(uuid) to authenticated;

-- The saved-meals cap (10 free, 500 Pro) and the daily limits, now on is_pro.
create or replace function public.enforce_saved_meals_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int := case when public.is_pro(new.user_id) then 500 else 10 end;
begin
  if (select count(*) from public.saved_meals where user_id = new.user_id) >= cap then
    raise exception 'saved meals limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.daily_limit(p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when public.is_pro(auth.uid()) then null
    when p_kind = 'search' then 10
    else 5
  end;
$$;

-- Lockdown: the app edits its own row only through these columns. Rows are
-- created by handle_new_user and removed with the auth user, so no insert
-- or delete either. Reads stay as they were (own row, by RLS).
revoke insert, update, delete, truncate on public.users from anon, authenticated;
grant update (display_name, avatar_url, preferences, seen_intros, bio, show_saved_public, newsletter_subscribed, earn_pro_prompt)
  on public.users to authenticated;

-- ---- Pro rewards -------------------------------------------------------------
-- 7 days of Pro for a user's first approved recipe and 2 days for their
-- first Food Post with a photo: each claimed once. Granted by the database as it
-- happens (from 2026-11-08 on, no backfill), once per source, logged here.
-- Earned days run from when they're earned (stacking on earned days still
-- left), so for someone subscribed they overlap Pro they already have.

create table public.pro_rewards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       text not null check (kind in ('recipe', 'photo_post')),
  -- The approved meal, or the Food Post.
  source_id  uuid not null,
  days       integer not null check (days > 0),
  granted_at timestamptz not null default now(),
  unique (kind, source_id)
);
create index pro_rewards_user_idx on public.pro_rewards (user_id);

alter table public.pro_rewards enable row level security;
create policy "Users read own rewards" on public.pro_rewards
  for select to authenticated using (auth.uid() = user_id);
-- Read only (own rows, by the policy); written only by grant_pro_reward.
revoke all on public.pro_rewards from anon, authenticated;
grant select on public.pro_rewards to authenticated;

create function public.grant_pro_reward(p_user uuid, p_kind text, p_source uuid, p_days integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inserted int;
begin
  insert into public.pro_rewards (user_id, kind, source_id, days)
    values (p_user, p_kind, p_source, p_days)
    on conflict (kind, source_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;
  update public.users
    set pro_reward_until = greatest(now(), coalesce(pro_reward_until, now())) + make_interval(days => p_days)
    where id = p_user;
end $$;
-- Only the triggers below call it.
revoke execute on function public.grant_pro_reward(uuid, text, uuid, integer) from public, anon, authenticated;

-- A recipe turning approved: 7 days for its poster, for their first one only.
create function public.reward_approved_recipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.poster_id is not null
     and new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and not exists (select 1 from public.pro_rewards where user_id = new.poster_id and kind = 'recipe')
  then
    perform public.grant_pro_reward(new.poster_id, 'recipe', new.id, 7);
  end if;
  return new;
end $$;

create trigger reward_approved_recipe
  after insert or update of status on public.meals
  for each row execute function public.reward_approved_recipe();

-- A user's first Food Post with a photo: 2 days, once.
create function public.reward_first_photo_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.image_url is not null
     and not exists (select 1 from public.pro_rewards where user_id = new.user_id and kind = 'photo_post')
  then
    perform public.grant_pro_reward(new.user_id, 'photo_post', new.id, 2);
  end if;
  return new;
end $$;

create trigger reward_first_photo_post
  after insert on public.food_posts
  for each row execute function public.reward_first_photo_post();
