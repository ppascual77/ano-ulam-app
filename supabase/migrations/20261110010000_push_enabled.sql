-- The notification setting is general, not per type: Settings → Notifications
-- → Push notifications switches every push off (recipe approved now, more
-- later), so the column says so. The grant moves with the rename.

alter table public.users rename column push_recipe_updates to push_enabled;

-- Same function, reading the renamed column (a plpgsql body isn't updated by
-- a rename).
create or replace function public.notify_recipe_approved() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_days int;
  v_body text;
  v_messages jsonb;
begin
  if new.poster_id is null
     or new.status <> 'approved'
     or old.status is not distinct from 'approved'
     or not exists (select 1 from public.users where id = new.poster_id and push_enabled)
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

