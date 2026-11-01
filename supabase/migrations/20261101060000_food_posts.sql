-- Community feed: food posts and their likes move from the app's mock
-- (core/posts/mock/posts.ts) to the database. Same fields as the web app's
-- food_posts rows. The feed is for signed-in users only (guests get the
-- app's join prompt).
--
-- Authors' names and avatars live on `users`, which stays owner-only: the
-- feed is read through get_food_posts below, which returns only what a post
-- card shows.

create table public.food_posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  caption          text check (char_length(caption) <= 2000),
  -- Photo in the post-images bucket (public URL).
  image_url        text,
  link_url         text,
  link_title       text,
  link_description text,
  link_image       text,
  -- Klipy media URLs.
  gif_url          text,
  sticker_url      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Something to show: a caption or an attachment.
  constraint food_posts_not_empty check (
    nullif(btrim(caption), '') is not null
    or image_url is not null or link_url is not null
    or gif_url is not null or sticker_url is not null
  ),
  -- Photo, GIF and sticker are mutually exclusive (the composer's rule).
  constraint food_posts_one_media check (
    (image_url is not null)::int + (gif_url is not null)::int + (sticker_url is not null)::int <= 1
  )
);

create index food_posts_created_at_idx on public.food_posts (created_at desc, id desc);
create index food_posts_user_created_idx on public.food_posts (user_id, created_at desc, id desc);

create function public.touch_food_post() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger food_posts_touch
  before update on public.food_posts
  for each row execute function public.touch_food_post();

alter table public.food_posts enable row level security;

create policy "Signed-in users read posts" on public.food_posts
  for select to authenticated using (true);
create policy "Users create own posts" on public.food_posts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users edit own posts" on public.food_posts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own posts" on public.food_posts
  for delete to authenticated using (auth.uid() = user_id);

-- One like per user per post. Counted live by get_food_posts (no stored
-- count to keep in step or to tamper with).
create table public.food_post_likes (
  post_id    uuid not null references public.food_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index food_post_likes_user_idx on public.food_post_likes (user_id);

alter table public.food_post_likes enable row level security;

create policy "Users read own likes" on public.food_post_likes
  for select to authenticated using (auth.uid() = user_id);
create policy "Users like as themselves" on public.food_post_likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users unlike as themselves" on public.food_post_likes
  for delete to authenticated using (auth.uid() = user_id);

-- The feed (p_user_id null) or one user's posts (a profile), newest first,
-- one page at a time. Each post comes with its author's name and avatar,
-- its like count and whether the signed-in user liked it.
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
  liked            boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.user_id, u.display_name, u.avatar_url,
    p.caption, p.image_url, p.link_url, p.link_title, p.link_description, p.link_image,
    p.gif_url, p.sticker_url, p.created_at, p.updated_at,
    (select count(*)::integer from public.food_post_likes l where l.post_id = p.id),
    exists (select 1 from public.food_post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.food_posts p
  join public.users u on u.id = p.user_id
  where auth.uid() is not null
    and (p_user_id is null or p.user_id = p_user_id)
  order by p.created_at desc, p.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 0), 50);
$$;

revoke execute on function public.get_food_posts(uuid, integer, integer) from public, anon;
grant execute on function public.get_food_posts(uuid, integer, integer) to authenticated;

-- Post photos. Public read (shared post links show them); each user writes
-- only under their own folder: `<user id>/<file>`.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "Anyone can view post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Users upload own post images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own post images"
  on storage.objects for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own post images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
