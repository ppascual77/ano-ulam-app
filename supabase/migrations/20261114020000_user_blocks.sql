-- Blocking (App Store Guideline 1.2: users must be able to block abusive
-- users). Blocking someone hides their posts from you everywhere posts show
-- (the Community feed and their profile's posts, both via get_food_posts).
-- Private: the blocked person isn't told and sees nothing different.
-- Unblock in Settings → Blocked accounts.

create table public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

-- Only your own blocks: see, add, remove. Nobody can see who blocked them.
create policy "Users read own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "Users block others" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users unblock" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

-- The feed, as before (20261108030000), minus posts by people you blocked.
create or replace function public.get_food_posts(p_user_id uuid default null, p_offset integer default 0, p_limit integer default 5)
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
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
  order by p.created_at desc, p.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 0), 50);
$$;
revoke execute on function public.get_food_posts(uuid, integer, integer) from public, anon;
grant execute on function public.get_food_posts(uuid, integer, integer) to authenticated;

-- Settings → Blocked accounts: the people you blocked, newest first, with the
-- name and photo to recognise them by.
create function public.get_blocked_users()
returns table (user_id uuid, display_name varchar, avatar_url text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, u.display_name, u.avatar_url, b.created_at
  from public.user_blocks b
  join public.users u on u.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
revoke execute on function public.get_blocked_users() from public, anon;
grant execute on function public.get_blocked_users() to authenticated;
