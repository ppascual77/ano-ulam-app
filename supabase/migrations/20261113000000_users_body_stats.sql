-- Body stats for the nutrition goal setup (weight, height, age, sex, body
-- fat, plus the goal and activity picked with them) move from the phone to
-- the account, so the setup prefills on any device and after a reinstall.
-- Health data: its own column rather than inside `preferences`. The users
-- row is already owner-only (RLS), and get_public_profile doesn't return it.
-- Shape (set by the app): {"weightKg", "heightCm", "age", "sex",
-- "bodyFatPct" (or null), "goal", "activity"}.

alter table public.users
  add column body_stats jsonb
  constraint users_body_stats_is_object check (body_stats is null or jsonb_typeof(body_stats) = 'object');

grant update (body_stats) on public.users to authenticated;
