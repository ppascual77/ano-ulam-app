-- Which page intros (Browse, Price Watch, Discover, Meal Planner) a user has
-- seen, so each plays once per account, not once per phone. Its own column
-- rather than inside users.preferences: preferences are saved whole from
-- Settings, and a second writer there could overwrite a fresh change.
-- Users already update their own row (the "Users can update own row"
-- policy); include this column when that policy is narrowed before release.
alter table public.users add column seen_intros text[] not null default '{}';
