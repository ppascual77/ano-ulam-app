-- Push notifications: "Your recipe is live" when an admin approves a user's
-- recipe (with "+7 days of Pro" when that approval earned the reward).
--
-- - push_tokens: each phone's Expo push token, saved by the app once the
--   user allows notifications. Written only through the two functions below
--   (a phone that changes accounts moves its token to the new one).
-- - users.push_recipe_updates: the Settings toggle, on by default.
-- - The trigger sends the push straight to Expo's push service with pg_net
--   (no secret needed), right after reward_approved_recipe has run.

create extension if not exists pg_net with schema extensions;

-- ---- The setting ---------------------------------------------------------------

alter table public.users add column push_recipe_updates boolean not null default true;
-- Joins the columns the app may update on its own row (20261108010000).
grant update (push_recipe_updates) on public.users to authenticated;

-- ---- Tokens --------------------------------------------------------------------

create table public.push_tokens (
  -- ExponentPushToken[...], one per app install.
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "Users read own push tokens" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

-- Saves this phone's token for the signed-in user (moving it from whoever
-- had it before, e.g. after a log out and a different log in).
create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'not an Expo push token';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
    values (p_token, auth.uid(), p_platform, now())
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- Forgets this phone's token (log out). Only the owner's own row.
create function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---- Sending -------------------------------------------------------------------

-- A user's recipe turning approved: one push to each of the poster's phones,
-- unless they turned recipe updates off. Named to sort after
-- reward_approved_recipe (same-event triggers fire in name order), so the
-- reward row is already there when this checks for it.
create function public.notify_recipe_approved() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_days int;
  v_body text;
  v_messages jsonb;
begin
  if new.poster_id is null
     or new.status <> 'approved'
     or old.status is not distinct from 'approved'
     or not exists (select 1 from public.users where id = new.poster_id and push_recipe_updates)
  then
    return new;
  end if;

  select days into v_days from public.pro_rewards where kind = 'recipe' and source_id = new.id;
  v_body := case
    when v_days is not null then format('%s is now on AnoUlam. You''ve earned %s days of Pro!', new.name, v_days)
    else format('%s is now on AnoUlam for everyone to cook.', new.name)
  end;

  select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', 'Your recipe is live! 🎉',
      'body', v_body,
      'sound', 'default',
      'data', jsonb_build_object('type', 'recipe_approved', 'mealId', new.id)
    ))
    into v_messages
    from public.push_tokens t
    where t.user_id = new.poster_id;

  if v_messages is not null then
    -- Async: queued by pg_net, sent after the approval commits; a failed
    -- send never blocks the approval.
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
end $$;

create trigger reward_approved_recipe_notify
  after update of status on public.meals
  for each row execute function public.notify_recipe_approved();
