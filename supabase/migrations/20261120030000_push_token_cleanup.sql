-- Dead push tokens get removed (audit F9). An uninstalled app's token stayed
-- in push_tokens forever and every scheduled push kept going to it, because
-- nothing read Expo's answers. Expo says a device is gone in two places:
--
-- 1. the ticket in the reply to each send (pg_net keeps replies in
--    net._http_response for a few hours), and
-- 2. the receipt for an accepted ticket, asked for later (Expo has it
--    within ~15 minutes and keeps it for 24 hours).
--
-- Either one saying DeviceNotRegistered deletes that token. send_expo_push
-- now records which token went in which position of each request
-- (push_deliveries); process_push_responses, every 30 minutes (pg_cron),
-- reads the replies, keeps accepted tickets' receipt ids (push_receipts),
-- asks Expo for receipts once they're 15 minutes old, and reads those
-- answers on its next run. Both tables are server-only: RLS on, no policies.

create table public.push_deliveries (
  request_id     bigint primary key,
  kind           text not null check (kind in ('send', 'receipts')),
  -- send: the token of each message, in the order sent.
  tokens         text[],
  -- receipts: receipt id -> token, for what this request asked about.
  receipt_tokens jsonb,
  created_at     timestamptz not null default now()
);

create table public.push_receipts (
  receipt_id   text primary key,
  token        text not null,
  created_at   timestamptz not null default now(),
  requested_at timestamptz
);

alter table public.push_deliveries enable row level security;
alter table public.push_receipts enable row level security;
revoke all on public.push_deliveries, public.push_receipts from anon, authenticated;

-- Same as 20261113040000_push_android_channel.sql, plus the delivery record.
create or replace function public.send_expo_push(p_messages jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_chunk jsonb;
  v_id bigint;
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then
    return;
  end if;
  for v_chunk in
    select jsonb_agg(case when m ? 'channelId' then m else m || '{"channelId": "default"}'::jsonb end order by n) from (
      select m, n, (n - 1) / 100 as grp from jsonb_array_elements(p_messages) with ordinality as x(m, n)
    ) x group by grp
  loop
    v_id := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_chunk,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    insert into public.push_deliveries (request_id, kind, tokens)
      values (v_id, 'send', array(select e ->> 'to' from jsonb_array_elements(v_chunk) with ordinality as t(e, n) order by n))
      on conflict (request_id) do nothing;
  end loop;
end $$;

create or replace function public.process_push_responses() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  d record;
  v_body jsonb;
  v_ticket jsonb;
  v_i integer;
  v_key text;
  v_val jsonb;
  v_removed integer := 0;
  v_n integer;
  v_map jsonb;
  v_id bigint;
begin
  -- 1. Answers that have arrived.
  for d in
    select pd.*, r.status_code, r.content
    from public.push_deliveries pd
    join net._http_response r on r.id = pd.request_id
  loop
    begin
      v_body := d.content::jsonb;
    exception when others then
      v_body := null;
    end;

    if d.status_code = 200 and v_body is not null then
      if d.kind = 'send' and jsonb_typeof(v_body -> 'data') = 'array' then
        v_i := 0;
        for v_ticket in select e from jsonb_array_elements(v_body -> 'data') with ordinality as t(e, n) order by n loop
          v_i := v_i + 1;
          continue when d.tokens[v_i] is null;
          if v_ticket ->> 'status' = 'error' and v_ticket -> 'details' ->> 'error' = 'DeviceNotRegistered' then
            delete from public.push_tokens where token = d.tokens[v_i];
            get diagnostics v_n = row_count;
            v_removed := v_removed + v_n;
          elsif v_ticket ->> 'status' = 'ok' and v_ticket ? 'id' then
            insert into public.push_receipts (receipt_id, token) values (v_ticket ->> 'id', d.tokens[v_i])
              on conflict (receipt_id) do nothing;
          end if;
        end loop;
      elsif d.kind = 'receipts' and jsonb_typeof(v_body -> 'data') = 'object' then
        for v_key, v_val in select * from jsonb_each(v_body -> 'data') loop
          if v_val ->> 'status' = 'error' and v_val -> 'details' ->> 'error' = 'DeviceNotRegistered' then
            delete from public.push_tokens where token = d.receipt_tokens ->> v_key;
            get diagnostics v_n = row_count;
            v_removed := v_removed + v_n;
          end if;
        end loop;
        -- Asked and answered (or not ready: Expo leaves those out; they
        -- age out below rather than being asked about forever).
        delete from public.push_receipts
          where receipt_id in (select jsonb_object_keys(d.receipt_tokens))
            and receipt_id in (select jsonb_object_keys(v_body -> 'data'));
      end if;
    end if;
    delete from public.push_deliveries where request_id = d.request_id;
  end loop;

  -- Replies pg_net no longer has, and receipts Expo no longer keeps.
  delete from public.push_deliveries where created_at < now() - interval '1 day';
  delete from public.push_receipts where created_at < now() - interval '2 days';

  -- 2. Ask for receipts 15+ minutes old (not asked in the last hour), up to
  -- Expo's 1000 per request.
  select jsonb_object_agg(receipt_id, token) into v_map
  from (
    select receipt_id, token from public.push_receipts
    where created_at < now() - interval '15 minutes'
      and (requested_at is null or requested_at < now() - interval '1 hour')
    order by created_at
    limit 1000
  ) r;
  if v_map is not null then
    v_id := net.http_post(
      url := 'https://exp.host/--/api/v2/push/getReceipts',
      body := jsonb_build_object('ids', (select jsonb_agg(k) from jsonb_object_keys(v_map) k)),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    insert into public.push_deliveries (request_id, kind, receipt_tokens) values (v_id, 'receipts', v_map)
      on conflict (request_id) do nothing;
    update public.push_receipts set requested_at = now()
      where receipt_id in (select jsonb_object_keys(v_map));
  end if;

  return format('%s dead tokens removed; asked for %s receipts', v_removed, coalesce((select count(*) from jsonb_object_keys(v_map)), 0));
end $$;

revoke execute on function public.process_push_responses() from public, anon, authenticated;

select cron.schedule('push-token-cleanup', '*/30 * * * *', 'select public.process_push_responses()');
