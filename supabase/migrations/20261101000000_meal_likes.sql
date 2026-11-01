-- Meal likes: one row per user per meal (Meal Detail, meal cards, Discover,
-- Browse), and each meal's like_count kept by the database itself, so it
-- can't drift from the rows or be set by a client.

alter table public.meals add column like_count integer not null default 0;

create table public.meal_likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  meal_id    uuid not null references public.meals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, meal_id)
);

alter table public.meal_likes enable row level security;
create policy "Users read own likes" on public.meal_likes
  for select to authenticated using (auth.uid() = user_id);
create policy "Users like as themselves" on public.meal_likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users unlike their own" on public.meal_likes
  for delete to authenticated using (auth.uid() = user_id);

-- like_count follows the rows (security definer: clients can't update meals
-- for this themselves once the meals policies are locked down).
create function public.sync_meal_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.meals set like_count = like_count + 1 where id = new.meal_id;
  elsif tg_op = 'DELETE' then
    update public.meals set like_count = greatest(like_count - 1, 0) where id = old.meal_id;
  end if;
  return null;
end $$;

create trigger meal_likes_count
  after insert or delete on public.meal_likes
  for each row execute function public.sync_meal_like_count();
