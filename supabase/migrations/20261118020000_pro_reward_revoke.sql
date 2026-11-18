-- Taking a Pro reward back when what earned it goes away. Before this, a
-- user could post any photo, get 7 days of Pro, and delete the post the
-- same minute, keeping the days.
--
-- A reward is taken back when:
-- - its Food Post is deleted, has its photo edited out, or is hidden by
--   moderation (an admin, or 3 reports);
-- - its recipe is deleted, or rejected after being approved (not sent
--   back to review by an edit: that's a normal change, not a removal).
--
-- Taken back = marked revoked_at, and the user's earned Pro
-- (users.pro_reward_until) recomputed from the rewards still standing, the
-- same way grant_pro_reward stacks them (each runs from when it was
-- granted, or from the end of the one before). Recomputing, not
-- subtracting: days already used up can't be taken twice (a first reward
-- that ran out before a second was granted). It never lengthens Pro, and
-- if nothing is left, earned Pro ends now.
--
-- The reward stays claimed: the reward triggers check for any row of that
-- kind, revoked or not, so a new post doesn't earn it again (otherwise:
-- post, delete on day 6, post again, forever). Only the one post or recipe
-- that earned the reward matters; deleting any other changes nothing.
-- Subscriptions (users.pro_until) are untouched.
--
-- No backfill (no rewards to revisit yet).

alter table public.pro_rewards add column revoked_at timestamptz;

create function public.recompute_pro_reward_until(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_until timestamptz;
begin
  for r in
    select granted_at, days from public.pro_rewards
    where user_id = p_user and revoked_at is null
    order by granted_at
  loop
    v_until := greatest(r.granted_at, coalesce(v_until, r.granted_at)) + make_interval(days => r.days);
  end loop;
  update public.users
    set pro_reward_until = case
      when v_until is not null and v_until > now() then least(v_until, pro_reward_until)
      -- Nothing left: ends now (or stays at its end, if that's past).
      else least(pro_reward_until, now())
    end
    where id = p_user and pro_reward_until is not null;
end $$;

create function public.revoke_pro_reward(p_kind text, p_source uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  update public.pro_rewards set revoked_at = now()
    where kind = p_kind and source_id = p_source and revoked_at is null
    returning user_id into v_user;
  if v_user is null then
    return;
  end if;
  perform public.recompute_pro_reward_until(v_user);
end $$;

-- Only the triggers below call them.
revoke execute on function public.recompute_pro_reward_until(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_pro_reward(text, uuid) from public, anon, authenticated;

-- ---- Food Posts ----------------------------------------------------------------

create function public.revoke_reward_for_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.revoke_pro_reward('photo_post', old.id);
    return old;
  end if;
  if (old.image_url is not null and new.image_url is null)
     or (old.hidden_at is null and new.hidden_at is not null)
  then
    perform public.revoke_pro_reward('photo_post', new.id);
  end if;
  return new;
end $$;

create trigger revoke_reward_for_post_delete
  after delete on public.food_posts
  for each row execute function public.revoke_reward_for_post();

create trigger revoke_reward_for_post_update
  after update of image_url, hidden_at on public.food_posts
  for each row execute function public.revoke_reward_for_post();

-- ---- Recipes ---------------------------------------------------------------------

create function public.revoke_reward_for_recipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.revoke_pro_reward('recipe', old.id);
    return old;
  end if;
  if old.status = 'approved' and new.status = 'rejected' then
    perform public.revoke_pro_reward('recipe', new.id);
  end if;
  return new;
end $$;

create trigger revoke_reward_for_recipe_delete
  after delete on public.meals
  for each row execute function public.revoke_reward_for_recipe();

create trigger revoke_reward_for_recipe_update
  after update of status on public.meals
  for each row execute function public.revoke_reward_for_recipe();
