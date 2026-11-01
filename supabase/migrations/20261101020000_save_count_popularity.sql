-- A meal's popularity is how many people saved it, not liked it: saving
-- means "I plan to cook this". meals.save_count is kept by the database
-- from saved_meals (counting saves of catalog meals; a save whose meal was
-- deleted has no meal_id and counts for nothing). Meal likes are dropped.

alter table public.meals add column save_count integer not null default 0;

-- Start from the saves people already have.
update public.meals m
set save_count = (select count(*) from public.saved_meals s where s.meal_id = m.id);

create function public.sync_meal_save_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('DELETE', 'UPDATE') and old.meal_id is not null
     and (tg_op = 'DELETE' or new.meal_id is distinct from old.meal_id) then
    update public.meals set save_count = greatest(save_count - 1, 0) where id = old.meal_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.meal_id is not null
     and (tg_op = 'INSERT' or new.meal_id is distinct from old.meal_id) then
    update public.meals set save_count = save_count + 1 where id = new.meal_id;
  end if;
  return null;
end $$;

create trigger saved_meals_count
  after insert or delete or update of meal_id on public.saved_meals
  for each row execute function public.sync_meal_save_count();

-- Meal likes (20261101000000) are replaced by saves.
drop trigger meal_likes_count on public.meal_likes;
drop function public.sync_meal_like_count();
drop table public.meal_likes;
alter table public.meals drop column like_count;
