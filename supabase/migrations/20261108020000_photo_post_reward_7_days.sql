-- The first Food Post with a photo now earns 7 days of Pro (was 2), the
-- same as a first approved recipe. Still once per user. Matches
-- POST_REWARD_DAYS in the app's core/pro/proContent.ts.
create or replace function public.reward_first_photo_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.image_url is not null
     and not exists (select 1 from public.pro_rewards where user_id = new.user_id and kind = 'photo_post')
  then
    perform public.grant_pro_reward(new.user_id, 'photo_post', new.id, 7);
  end if;
  return new;
end $$;
