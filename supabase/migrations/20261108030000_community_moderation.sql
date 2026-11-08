-- Community moderation: people report Food Posts, admins remove them.
--
-- - public.is_admin(): the signed-in user's app_metadata role is admin (set
--   server-side; users can't edit it). The database's own admin check.
-- - food_posts.hidden_at / hidden_reason: a removed post is hidden, not
--   deleted (reversible). Hidden posts leave every feed and profile, except
--   their poster's own list, where the app labels them "Removed".
-- - post_reports: one report per person per post, with a reason and an
--   optional note. Reporting hides the post for the reporter straight away
--   (get_food_posts), and 3 open reports hide it for everyone until an
--   admin reviews it.
-- - Admin functions: get_reported_posts, remove_post, dismiss_post_reports.

create function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.food_posts
  add column hidden_at timestamptz,
  add column hidden_reason text check (hidden_reason in ('admin', 'reports'));

-- Posters edit their own posts only through these columns, so a removed
-- post can't be un-hidden by its poster (hidden_at stays admin/report-only).
revoke insert, update on public.food_posts from anon, authenticated;
grant insert (user_id, caption, image_url, gif_url, sticker_url, link_url, link_title, link_description, link_image)
  on public.food_posts to authenticated;
grant update (caption, image_url, gif_url, sticker_url, link_url, link_title, link_description, link_image, updated_at)
  on public.food_posts to authenticated;

create table public.post_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.food_posts(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason      text not null check (reason in ('spam', 'not_food', 'offensive', 'misleading', 'other')),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  -- Set when an admin acts on the post: removed it, or dismissed reports.
  resolved_at timestamptz,
  resolution  text check (resolution in ('removed', 'dismissed')),
  unique (post_id, reporter_id)
);
create index post_reports_open_idx on public.post_reports (post_id) where resolved_at is null;

-- Written only through report_post; read your own, admins read all.
alter table public.post_reports enable row level security;
create policy "Users read own reports, admins read all" on public.post_reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
revoke all on public.post_reports from anon, authenticated;
grant select on public.post_reports to authenticated;

-- How many open reports hide a post for everyone, pending review.
create function public.report_post(p_post uuid, p_reason text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.food_posts where id = p_post and user_id = v_user) then
    raise exception 'cannot report your own post' using errcode = '22023';
  end if;
  insert into public.post_reports (post_id, reporter_id, reason, note)
    values (p_post, v_user, p_reason, nullif(trim(p_note), ''))
    on conflict (post_id, reporter_id) do nothing;
  -- Three open reports: hidden for everyone until an admin reviews it.
  update public.food_posts
    set hidden_at = now(), hidden_reason = 'reports'
    where id = p_post
      and hidden_at is null
      and (select count(*) from public.post_reports where post_id = p_post and resolved_at is null) >= 3;
end $$;
revoke execute on function public.report_post(uuid, text, text) from public, anon;
grant execute on function public.report_post(uuid, text, text) to authenticated;

-- Admin: hide a post for everyone and close its reports.
create function public.remove_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.food_posts set hidden_at = now(), hidden_reason = 'admin' where id = p_post;
  update public.post_reports set resolved_at = now(), resolution = 'removed'
    where post_id = p_post and resolved_at is null;
end $$;
revoke execute on function public.remove_post(uuid) from public, anon;
grant execute on function public.remove_post(uuid) to authenticated;

-- Admin: the post is fine. Closes its reports and shows it again (if the
-- reports had hidden it, or an admin had).
create function public.dismiss_post_reports(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.post_reports set resolved_at = now(), resolution = 'dismissed'
    where post_id = p_post and resolved_at is null;
  update public.food_posts set hidden_at = null, hidden_reason = null where id = p_post;
end $$;
revoke execute on function public.dismiss_post_reports(uuid) from public, anon;
grant execute on function public.dismiss_post_reports(uuid) to authenticated;

-- Admin: posts with open reports, most reported first.
create function public.get_reported_posts()
returns table (
  id           uuid,
  user_id      uuid,
  display_name varchar,
  avatar_url   text,
  caption      text,
  image_url    text,
  link_url     text,
  gif_url      text,
  sticker_url  text,
  created_at   timestamptz,
  hidden       boolean,
  report_count integer,
  reasons      text[],
  notes        text[],
  last_reported_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.user_id, u.display_name, u.avatar_url,
    p.caption, p.image_url, p.link_url, p.gif_url, p.sticker_url, p.created_at,
    p.hidden_at is not null,
    count(r.id)::integer,
    array_agg(r.reason order by r.created_at),
    array_remove(array_agg(r.note order by r.created_at), null),
    max(r.created_at)
  from public.post_reports r
  join public.food_posts p on p.id = r.post_id
  join public.users u on u.id = p.user_id
  where public.is_admin() and r.resolved_at is null
  group by p.id, u.display_name, u.avatar_url
  order by count(r.id) desc, max(r.created_at) desc;
$$;
revoke execute on function public.get_reported_posts() from public, anon;
grant execute on function public.get_reported_posts() to authenticated;

-- The feed, now leaving out hidden posts (except your own, flagged
-- `hidden` so the app can label them) and posts you've reported.
drop function public.get_food_posts(uuid, integer, integer);
create function public.get_food_posts(p_user_id uuid default null, p_offset integer default 0, p_limit integer default 5)
returns table (
  id               uuid,
  user_id          uuid,
  display_name     varchar,
  avatar_url       text,
  caption          text,
  image_url        text,
  link_url         text,
  link_title       text,
  link_description text,
  link_image       text,
  gif_url          text,
  sticker_url      text,
  created_at       timestamptz,
  updated_at       timestamptz,
  like_count       integer,
  liked            boolean,
  hidden           boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.user_id, u.display_name, u.avatar_url,
    p.caption, p.image_url, p.link_url, p.link_title, p.link_description, p.link_image,
    p.gif_url, p.sticker_url, p.created_at, p.updated_at,
    (select count(*)::integer from public.food_post_likes l where l.post_id = p.id),
    exists (select 1 from public.food_post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.hidden_at is not null
  from public.food_posts p
  join public.users u on u.id = p.user_id
  where auth.uid() is not null
    and (p_user_id is null or p.user_id = p_user_id)
    and (p.hidden_at is null or p.user_id = auth.uid())
    and not exists (select 1 from public.post_reports r where r.post_id = p.id and r.reporter_id = auth.uid())
  order by p.created_at desc, p.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 0), 50);
$$;
revoke execute on function public.get_food_posts(uuid, integer, integer) from public, anon;
grant execute on function public.get_food_posts(uuid, integer, integer) to authenticated;
