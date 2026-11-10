# Analytics

What to measure once real users are on the app, and the events that needs. Started 2026-11-08.

**No analytics tool is in the app yet.** Pick one before launch (PostHog is a common choice for
Expo: event tracking, funnels, retention, and a free tier). Revenue and subscriptions already
report themselves in RevenueCat's dashboard (trials, conversions, renewals, churn): use that
for money, and the tool below for behaviour. Never log personal data (names, emails, what someone
typed in a search); the Supabase user id is enough to tie events to an account.

## Pro: the results wall and limits

The free tier's limits (decided 2026-11-08, see `docs/integration-status.md`, "STUDY: the results
depth cap"): 10 results per result row, Pantry search or See All; 10 meal searches, 3 Suggest by
Budget and 3 Suggest by Pantry a day.

### Questions to answer

1. **Upgrade rate from the "See every match with Pro" card**, compared with the other ways into
   Pro: Settings, locked planner days, the macro goal lock, locked micronutrients, the saved-meals
   limit sheet, the daily limit sheet. Which entry points actually sell Pro?
2. **Do free users who hit the wall come back the next day?** The real test of "not too
   restrictive": compare next-day (and 7-day) return for free users who saw the card or a limit
   sheet against free users who didn't.
3. **First-week churn.** New users who hit limits early tend to churn fastest. If accounts that
   hit a limit in their first week return less than those that didn't, try a softer first week,
   e.g. no caps for a new account's first 7 days.

Also worth knowing: how often free users reach the card at all (if rarely, the cap barely
matters), and, if built, whether a blurred preview of the locked meals lifts taps on the card.

### Events to log

| Event | When | Properties |
| --- | --- | --- |
| `pro_wall_shown` | The "See every match with Pro" card comes into view | `screen` (browse, budget, pantry, see_all), `hidden_count` |
| `limit_sheet_shown` | A daily limit sheet or the saved-meals limit sheet opens | `kind` (search, budget, pantry, saved_meals) |
| `pro_page_opened` | The Pro page opens | `source` (results_wall, limit_sheet, saved_limit, settings, locked_day, macro_goal, micros, …) |
| `trial_started` / `purchase_completed` | Apple's purchase goes through | `plan`, `source` (the `pro_page_opened` source it came from) |
| `app_opened` | The app comes to the front | `is_pro`, `account_age_days` |
| `push_permission` | Notification permission changes (quiet at sign-in, banners via "Notify me" or Settings, refused) | `state` (quiet, granted, denied), `source` (sign_in, recipe_submitted, settings) |
| `push_opened` | A push is tapped | `type` (recipe_approved, price_drop, weekly_best_buys) |

Push questions: do price pushes bring people back (`push_opened` → `app_opened` sessions), does
the free weekly line lead to `pro_page_opened` (and Pro), and how many quiet users upgrade to
banners. The server already logs every price push sent (`price_alert_log.recipients`).

Each event carries the user id (or an anonymous id for guests), whether they're Pro, and the
account's age in days, so the questions above are straight funnels and retention cohorts:

- (1) `pro_page_opened` → `trial_started` / `purchase_completed`, split by `source`.
- (2) Free users with a `pro_wall_shown` or `limit_sheet_shown` on day N: share with an
  `app_opened` on day N+1 (and within 7 days), against free users without one.
- (3) The same, limited to accounts in their first 7 days.
