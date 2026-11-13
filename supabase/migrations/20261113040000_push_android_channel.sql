-- Android pushes land in the app's own "default" notification channel
-- (created by the app, frontend/core/notifications/push.ts: named
-- "Notifications"), not Expo's generic "Miscellaneous" fallback, so Android
-- shows them under a proper name in the app's notification settings. iOS
-- ignores channelId.
--
-- send_expo_push adds channelId to every message that has none, and the
-- recipe-approved push now goes through it too (it posted to Expo itself;
-- same message otherwise, body below unchanged apart from that).

create or replace function public.send_expo_push(p_messages jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_chunk jsonb;
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then
    return;
  end if;
  -- Expo takes up to 100 messages per request.
  for v_chunk in
    select jsonb_agg(case when m ? 'channelId' then m else m || '{"channelId": "default"}'::jsonb end) from (
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

CREATE OR REPLACE FUNCTION public.notify_recipe_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  -- Through send_expo_push (Android channel, batching). Async: queued by
  -- pg_net, sent after the approval commits; a failed send never blocks it.
  perform public.send_expo_push(v_messages);
  return new;
end $function$;
