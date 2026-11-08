-- Discover's "Your recipe could earn you Pro" sheet: when it was last shown
-- (the user's local calendar day, "YYYY-M-D") and how many times it was
-- dismissed, so "once a day, gone after 3 dismissals" follows the account
-- instead of resetting on every phone or reinstall. Its own column, like
-- seen_intros, rather than inside preferences (saved whole from Settings).
-- Users already update their own row (the "Users can update own row"
-- policy); include this column when that policy is narrowed before release.
alter table public.users
  add column earn_pro_prompt jsonb not null default '{"lastShownDay": null, "dismissals": 0}'::jsonb;
