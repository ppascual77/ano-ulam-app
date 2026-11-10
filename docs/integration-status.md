# Integration status

What runs on real data, what's partly real, and what's still mock or unbuilt, across the whole app.

Last updated: **2026-11-09** (profile photo upload; App Store subscriptions tested in sandbox 2026-11-08; live database state last checked 2026-11-06: deployed functions, tables, an anon write probe). Update this file whenever something moves between sections.

**Legend**

- **Integrated**: reads and writes real data (Supabase, or a real external source).
- **Partly integrated**: some of it is real, some is mock, in memory, or only on the phone.
- **Not integrated**: mock only, or not built yet.
- **In memory**: resets when the app reloads. **On the phone**: survives reloads (AsyncStorage), but not reinstalls or other devices.

---

## Summary

### Done since the last update (2026-11-07 to 11-09)

- **Profile photo upload** (2026-11-09, not tested on a device yet): tap your avatar on Profile to choose, change or remove a photo; Apple users no longer stuck on initials. See Integrated. The photo permission text in `app.json` now covers profile photos, posts and recipes (takes effect in the next dev build).

- **Pro in the database** (migration `20261108010000_pro_in_database`, applied): `users.pro_until` (the subscription, written by the `revenuecat-webhook` edge function) and `users.pro_reward_until` (earned), `is_pro()` used by the saved-meals cap and daily limits, and the `users` row locked down: the app can only update profile fields, never Pro, rewards or `tier` (checked: a signed-in user setting their own tier is denied). **Pro rewards** are live: 7 days for a user's first approved recipe and 7 for their first photo post (raised from 2 in `20261108020000`), granted by database triggers (once each, logged in `pro_rewards`, no backfill). The app counts earned days as Pro (Settings shows an Earned Pro card), and the login gate sheets and onboarding's account slide say "Share your first recipe, get 7 days of Pro free".
- **Webhook connected** (2026-11-08): `revenuecat-webhook` gets every subscription event from RevenueCat (secrets `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_SECRET_API_KEY` set; tested end to end, wrong password refused), so `users.pro_until` follows the subscription and the database's limits honour Pro.
- **Rewards in the app**: a celebration when a reward lands (gift medallion, "+7 days of Pro", once per reward; after a first photo post, and on the next open after a recipe is approved), the "Your recipe is in review" screen (track + reward pill), the redesigned Create sheet (two cards, reward strips, "Up to 14 days of Pro" pill), and a first-post nudge in the composer ("Add a photo to earn 7 days of Pro"). Reward strips show to free, earned-Pro and trial users, not paying subscribers.
- **Guest saves anywhere open the login sheet** (no more server error), then save the meal once signed in.
- **Pro on your own profile**: accent avatar ring, PRO badge with a glint (again every 10 s), "Pro since …" / "Earned Pro · until …".
- **Planner**: the macro goal is a Pro lock (premium card). Categories' breakfast icon matches the planner's.
- **Home's Community Favorites** is a magazine spread of the top 5 (wide hero, tall card with two small beside it, full-width closer; big rank numerals, saves as a top-right pill), no carousel.
- **Profile**: "Your plan this week" banner under the header (same rules as Home's plan card), a white liquid glass floating + (the only + on Profile; the Created tab's and the sticky header's are gone), the Created tab as simple labeled sections (RECIPES · n, FOOD POSTS · n) with posts as cards, the Community feed shortcut removed, and the bottom nav's Profile tab on the same pill as the other tabs.
- **Discover**: Recipes / Community as a centered glass capsule with a sliding white thumb and icons; the + is a plain circle the same height, aligned with it, opening the Create sheet in one tap; Community posts scroll under the tabs (white glass there).
- **Create sheet** redesigned (two cards with reward strips), and a first-post nudge in the composer ("Add a photo to earn 7 days of Pro").
- **Fresh picks (Price Watch)** swipe on the phone (native horizontal scroll). Dropdown menus stay on screen when right-aligned.

- **EAS dev build** (`expo-dev-client`, bundle `com.anoulam.app`): the app now runs in its own dev build, which Apple sign-in and purchases need. Expo Go still opens it (RevenueCat runs in a mock preview mode there).
- **Sign in with Apple**: native sheet + `signInWithIdToken`, name saved on first sign-in. Tested in the dev build.
- **Real App Store subscriptions** through RevenueCat, tested end to end in sandbox: trial, conversion, renewals, cancel, expiry, restore. See Pro subscription (Partly integrated) and `docs/compliance.md` for the App Store setup.
- **Onboarding redesign**: liquid glass sign-in buttons, 2-column goal tiles with nothing preselected, no next arrow. Preferences (onboarding, Settings, Home's sheet) have no "None" chip any more: nothing selected means none, with a Clear button.
- **Sign-in and log-out overlay** (full-screen spiral), guest profile rebalanced, guest avatar in the nav is a line icon.
- **"Your recipe could earn you Pro" sheet** on real data (see Partly integrated).
- **Meal Planner**: today's / whole-week grocery buttons (week locked for Free), orange locks, one back arrow while planning, the macro goal locked to Pro (a premium card), and locked days, the week's list and locked micronutrients open the full Pro page directly.
- **Pro page**: press carousel (Radar, Interaksyon), yearly price ₱599, prices from the App Store, Restore purchases. Settings' "See all Pro features" opens it too.

### Done in the round before (2026-11-01 to 11-06)

- **`food_posts` migration applied**: the tables and `get_food_posts` are live (checked 2026-11-06), so the Community tab loads.
- **Browse search shows avoided meals, blurred**: Pro's Ingredients to avoid no longer makes a search look empty. Matching meals stay in the results after the rest, blurred under "Uses an ingredient you avoid", with "Manage avoided ingredients" (opens the Settings sheet) and "View anyway". Adds `expo-blur`.
- **Meal images**: `generate-meal-image` (deployed v10, 2026-11-02) only picks ceramic plates and bowls on a table or cloth: no banana leaf, rattan, buri mat, clay pot or pan.
- **Home, Browse and Price Watch look**: green headers with a status bar strip that turns white on scroll, card shadows, and Home's Recommendations and budget form default to 2 servings.
- **Meal seeding**: the `/seed-meal` tool can now fix a meal it already saved (`update-saved`), and many more catalog meals were seeded through it.

### Earlier (to 2026-11-01)

- **Community feed and Food Posts** are real (`food_posts`, likes, photo uploads, link previews).
- **Pro features are built**, working behind a mock subscription: ingredients to avoid (one food or a whole food), nutrition goals (as planning targets across the app), and a 5 or 7 day meal plan length. (Price alerts and weekly savings were built, then their Price Watch cards removed; see Partly integrated.)
- **The Pro subscription is mocked end to end**: test checkout, unlock screen, a plan card in Settings, switching plans (confirmed, scheduled at renewal on a paid plan), cancelling and resuming, "See all Pro features".
- **Home's planner card follows your plan**: "Plan your week", "Today's plan" (today's meals, day N of M, the day vs your goals) or "Plan next week".

### What's left, in order

**Doable now (no developer accounts needed)**

1. **Deploy steps, no code**: deploy `delete-account` (still not deployed, 2026-11-06), and redeploy `ingest-da-daily-prices` (the live version, 2026-10-10 04:23 UTC, is older than its last code change that day).
2. **OpenAI model migration**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**. Still used by `import-meal-from-url`, `verify-meal-ingredients`, `estimate-ingredient-ai`, `estimate-pack-sizes` and `generate-meal-image` (its style description). Each needs a redeploy after.
3. **Security before release** (none of it started; an anon update on `ingredients` still succeeded on 2026-11-06): RLS lockdown (the `TEMP: anyone can update` policies, users setting their own `tier`), admin checks (`requireAdmin`) on the admin-only edge functions, the Klipy key behind a proxy (`EXPO_PUBLIC_KLIPY_API_KEY` is still in `api/klipy.ts`).
4. ~~**Community moderation**~~ **Built 2026-11-08** (`feat/community-moderation`, migration `20261108030000_community_moderation`, applied): Report in every other person's post menu (reason + optional note; the post leaves the reporter's feed; 3 open reports hide it for everyone pending review), admins get Remove post in the menu and Admin → Reported Posts (Remove / Dismiss or Restore). Removal hides, never deletes; the poster sees their own removed post labelled. `is_admin()` added (app_metadata role). Posters can only edit content columns, so they can't un-hide a removed post. Not tested on a device yet.
5. **Test Pro on device** (`docs/to-test.md`): the webhook, rewards, celebration and lockdown are live but only partly tested on a phone.
6. **Price alerts and weekly savings**: still promised in the paywall (`proContent.ts` Free vs Pro table, `ProUpgradeSheet`, `unlockedFeatures.ts`) with no surface. Decide where they live, or drop them from Settings and the paywall.
7. ~~**Fresh picks swipe (Price Watch)**~~ **Fixed 2026-11-08** (`fix/fresh-picks-native-scroll`, confirmed on the phone): the custom pan is gone; the cards page in a native horizontal ScrollView (gesture handler's, snapping one card at a time) inside the page's vertical one, with the tilt driven by the scroll position. The old attempts stay on `fix/fresh-picks-swipe`.
8. ~~**Small leftovers**~~ **Done 2026-11-08**: the planner's free tier (day 1 open, the rest locked) is by design now; "Your recipe could earn you Pro" moved to the account (and its progress to `pro_rewards`); `MealPlanBanner` is rebuilt and shown on Profile under the header while a plan runs today (today's meals, day N of M, what's up next; same rules as Home's plan card).
9. **Daily DA price import (cron job)**: Price Watch's DA prices only update when someone runs Admin → DA Daily Prices by hand. Schedule it daily (e.g. Supabase cron calling an edge function, each morning Manila time after DA posts the day's PDF). Design first: `ingest-da-daily-prices` only lists and parses (the app does the database write), and DA's site throttles server IPs on PDF downloads, so the cron needs a server-side write path and may be blocked from fetching the PDF. Also redeploy `ingest-da-daily-prices` (it's stale) as part of this.

**Needs developer accounts (skipped for now)**

- Google Play subscriptions (needs a Play Console account; RevenueCat covers both stores).
- Native Google sign-in.
- Push notifications (e.g. sending the daily price alert to the phone).

---

## Integrated

| Area | What's real | Where |
| --- | --- | --- |
| Sign-in | Apple (iOS, native sheet, `signInWithIdToken`; Apple sends the name only on first sign-in, saved then) and Google OAuth through Supabase Auth. In Expo Go it only works when served with `npm run tunnel` ([supabase/auth#2039](https://github.com/supabase/auth/issues/2039)). The dev build (2026-11-07) redirects to `anoulam://`, which has to be in Supabase's Redirect URLs. | `api/auth.ts` |
| Account and preferences | The `users` row: name, avatar, dietary focus, allergens, and the Pro settings in `users.preferences` (ingredients to avoid, nutrition goals, meal plan length, price alerts; acted on while Pro, see Partly integrated). Dietary focus and allergens **filter every "for you" list** (allergens always left out; vegetarian accepts vegan, pescatarian accepts both). | `api/auth.ts`, `core/preferences`, `core/budget/utils/budgetMatch.ts` |
| Meals catalog | `meals` and `meal_ingredients`: Discover reel, Browse search (with a Protein Source filter), Recommendations, Best Value meals, Meal Detail. Opening a meal from any list loads the full meal first, so ingredients and micronutrients always show. | `api/meals.ts`, `core/meals/hooks/useFullMeal.ts` |
| Ingredients and nutrition | `ingredients` grounded from USDA and FNRI, macros and micronutrients per meal, verification locks. | `api/ingredients.ts`, edge fns `ground-ingredients-usda`, `estimate-ingredient-ai`, `verify-meal-ingredients` |
| Prices | DA daily price import (Admin; the app downloads DA's PDF and the edge function parses it), store listings, AI pack estimates, Price Watch (fresh picks carousel, best value meals, every commodity), weekly price changes. | `api/daPrices.ts`, `api/priceWatch.ts`, `api/storeListings.ts`, edge fns `ingest-da-daily-prices`, `ground-ingredient-prices`, `estimate-pack-sizes` |
| Saved meals | `saved_meals`: save and unsave everywhere, servings updates. Database limit: 10 for free, 500 for `tier = 'pro'` (migration `20261031000000`, applied). | `api/saved.ts`, `core/saved` |
| Pantry | `pantry_items` (owner-only). A guest's pantry is kept on the phone and merged into the account on the first load after sign-in. Profile's Pantry tab reuses Home's pantry section. | `api/pantry.ts`, `core/pantry/hooks/usePantry.ts` |
| Grocery list | Built from the user's real saved meals, or the meal plan (Pro: the day being viewed or the whole plan, a "Shop for" switch; day ticks share the plan's list under day-prefixed keys, and a whole-plan tick counts for the day); "Have" tags read the real pantry. Checkboxes saved to `grocery_checks` per account and list (taps are instant and batched: sent when leaving the tab, closing the list, or backgrounding the app). A check made at another quantity reads as unchecked (restock). | `api/groceryChecks.ts`, `core/grocery/hooks/useSavedGroceryList.ts` |
| Suggest by Pantry | "What can you make?" matches the real pantry against the real catalog (count, match %, See meals results grouped by how ready they are to cook). | `core/pantry/hooks/usePantryMatches.ts`, `features/pantry` |
| Suggest by Budget | Real meals whose cost for the chosen servings is within **10%** of the budget (₱300 means ₱270 to ₱330), full price, closest first (or "Best for my goals" with nutrition goals). Follows preferences; the **Categories** tiles (Breakfast, Lunch, Dinner by meal-time tag, Fastfood) filter the rows. 5 at a time with a "Show More Meals" card; a clear-budget chip returns to Home. | `core/budget/utils/budgetMatch.ts`, `core/budget/components/MealSuggestion.tsx` |
| Recommendations | 10 random real meals; with a Home Categories tile picked, every meal in that category. Follows preferences. 5 at a time with a Show More card (no See All). | `core/meals/hooks/useRecommendedMeals.ts` |
| Surprise me (Home pull-down) | Lands on a random real meal that fits the user's preferences; View Details loads the full meal. | `features/home/components/RandomMealPuller.tsx`, `core/meals/hooks/usePreferredMeals.ts` |
| Today's pick (Browse) | One real home-cooked meal a day (with a photo when possible), the same all day, by date. Follows preferences. | `features/browse/hooks/useTodaysPick.ts` |
| Ulam moods (Browse) | Real meals by per-serving rule: Tipid under ₱150, High Protein 30g+, Quick & Easy 20 min or less, best fit first (cheapest / most protein / quickest). Follows preferences. A mood switch over photo tiles shared with Community Favorites (`MealPhotoTile`), laid out wide, pair, wide, with the mood's number (₱89, 42g, 15 min) where Favorites puts the rank; Show more adds the next four. | `features/browse/components/MoodSelection.tsx` |
| Related meals (Meal Detail) | Same category and protein ("More pork meals"), else other user recipes, else shared tags. Up to 8; opens the full meal. | `core/meals/components/detail/RelatedMeals.tsx` |
| Community Favorites (Home) | The top 10 most-saved real meals (hidden until there are some), following preferences. 5 at a time. | `core/budget/components/CommunityFavoritesSection.tsx` |
| Meal list ("See all") | Real meals. From Suggest by Budget: priced for the servings. From This week's best value meals: its own card. No filters. | `features/meals/screens/MealListScreen.tsx` |
| Meal popularity (saves) | Saves are the popularity signal. Each meal's `save_count` is kept by a database trigger on `saved_meals`; shown under the bookmark on meal cards and the Discover rail, and as a saved pill in Meal Details. Migration `20261101020000`. | `core/saved/hooks/useSavedMeals.ts`, `core/meals/components/card/MealCard.tsx` |
| Profile | Name and avatar from the session; Saved, Created recipes (with Food Posts) and Pantry are real. Bio (`users.bio`, 50 characters) and the settings "Show saved meals on your profile" (`users.show_saved_public`) and "Email newsletter" (`users.newsletter_subscribed`, saved only: nothing sends emails yet). Migration `20261101030000`. | `features/profile/hooks/useProfile.ts`, `api/auth.ts` |
| Profile photo | Tap your avatar on Profile (camera badge): Choose a photo / Change photo / Remove photo. The photo is cropped square, shrunk to 512 px and uploaded to `post-images` at `<user id>/avatar-<time>.jpg` (top of the user's folder, so `delete-account` removes it); `users.avatar_url` points at it and the previous one is removed. Remove goes back to initials (a Google photo is only unlinked). Your own avatar everywhere (Profile, bottom nav, the post composer) now reads `users.avatar_url`, not the sign-in metadata; others see it through `get_public_profile` / `get_food_posts`. No migration (the bucket's own-folder policies and the `avatar_url` grant already allow it). Not tested on a device yet. | `api/auth.ts` (`uploadAvatar`, `removeAvatar`), `features/profile/hooks/useProfile.ts` (`useAvatarActions`), `features/auth/hooks/useUserProfile.ts` (`useMyAvatarUrl`) |
| Other users' profiles | Real users (recipe posters and post authors): name, avatar, bio, approved recipes, food posts, and their saved meals when public. Read through `get_public_profile` and `get_public_saved_meals` (signed-in only, nothing private returned). | `api/profiles.ts`, `features/profile/screens/UserProfileScreen.tsx` |
| Community feed and Food Posts | `food_posts` and `food_post_likes` (migration `20261101060000`, applied). Discover's Community tab (5 at a time, pull to refresh) and each profile's Food Posts (10 at a time) read through `get_food_posts` (author name and avatar, live like count, your like; signed-in only). Post, edit and delete your own (RLS); photos in the `post-images` bucket under your own folder, removed with the post; link previews from the page's Open Graph tags (hostname if unreadable). Optimistic likes. No comments. | `api/posts.ts`, `core/posts/hooks/usePosts.ts` |
| Meal plans | One current plan per account (`meal_plans`, owner-only, migration `20261101040000`): the inputs plus the meal id in each slot per day (5 or 7 days), rebuilt from the catalog when opened. Saved after building, regenerating a day or swapping a meal. A running plan reopens as it was; an ended one goes back to setup with the budget, people and goal filled in. Its grocery ticks are the `plan` list. Guests plan in memory only. | `api/mealPlans.ts`, `features/meal-planner/hooks/useSavedMealPlan.ts` |
| Home planner card | Home's lead card, by state: "Plan your week" (no plan: a soft green invitation with a Start planning button and three meal photos fanned on the right), "Today's plan" while a plan runs (a photo-led card: the meal that's up next by time of day, "Tonight" or "Up next · Lunch", day N of M, the day's other two meals, and with nutrition goals the day's calories and protein vs them; opens the plan on today), "Plan next week" once it ends. Crossfades between states; a placeholder while the plan loads. Free plans show day 1 only. | `features/home/components/HomePlanCard.tsx`, `PlanWeekCard.tsx` |
| Daily limits | Searches (10 a day), Suggest by Budget (5) and Suggest by Pantry (5) for free accounts, counted per account in `daily_usage` (migration `20261101050000`). A Philippine day; repeats and refinements are free; Pro is unlimited. Guests (3 each) count on the phone. Still a soft limit: searches read the catalog directly. | `api/dailyUsage.ts`, `core/pro/dailyLimits.ts` |
| Page intros | Play once per page, per account: `users.seen_intros` (migration `20261101010000`) and on the phone. Settings' "Replay page intros" clears both. | `core/preferences/store/useSeenIntrosStore.ts`, `api/auth.ts` |
| User recipes | Add a Recipe, then pending, then admin approval in Review Recipes. | `api/recipes.ts` |
| Admin tools | Manage Meals and Ingredients, Seed Meal, import from URL, AI meal images, ingredient verification, DA linking and import. | `features/admin`, edge fns `import-meal-from-url`, `generate-meal-image` |
| Meal seeding | The `/seed-meal` skill writes real meals and `meal_sources`. | `.claude/skills/seed-meal` |
| GIF picker | Klipy API (the key is still in the app, see Before release). | `api/klipy.ts` |

## Partly integrated

Every row here works on real data. `isPro` is real now (the App Store subscription, through RevenueCat), but only the app knows it: the database doesn't yet (see Pro subscription).

| Area | Real | Not real yet |
| --- | --- | --- |
| Pro rewards (2026-11-08) | 7 days of Pro for a user's first approved recipe, and 7 for their first Food Post with a photo (was 2, migration `20261108020000`), each once (`pro_rewards`, unique per source and one per kind per user), granted by triggers on `meals` (status turning approved) and `food_posts` (insert with a photo) into `users.pro_reward_until`. Earned days run from when they're earned (stacking on earned days left), so for a subscriber they overlap Pro they already have. The app reads `pro_reward_until` (`useProStore.earnedUntil`): Pro while it runs, an Earned Pro card in Settings, off right when it ends. The Earn Pro sheet, the Create sheet's strips and the composer nudge read the reward log (`pro_rewards`), so they agree on what's claimed; a celebration plays once per reward (`RewardCelebration`, remembered per account on the phone). Reward pitches show to free, earned-Pro and trial users, not paying subscribers (`usePaysForPro`). | No backfill (only from 2026-11-08). No push notification when a recipe's days are earned: the celebration shows the next time the app opens or comes to the front. |
| Pro subscription (2026-11-08) | **Real App Store subscriptions, tested end to end in sandbox** (trial, conversion, renewals, cancel, expiry, restore). RevenueCat (`react-native-purchases` pinned to **10.16.0**: 11.x needs PurchasesHybridCommon 20.4.0, which isn't on CocoaPods trunk, so an EAS build would fail). `core/pro/store/useProStore.ts` reads the `anoulam_pro` entitlement (`isPro`), the App Store's prices and trial eligibility (no trial offered again once the account has had Pro), and logs RevenueCat in as the Supabase user (`_layout.tsx`), so Pro follows the account. Re-reads on Settings focus and after Apple's manage screen (cache skipped, purchases synced), and right when a period ends. The Pro page opens Apple's purchase sheet under a padlock confirm/unlock animation, asks guests to sign in first (`LoginGateSheet` reason `pro`), and has Restore purchases. Settings' plan card: Free trial / Active / Cancelled ("Pro until"), and Expired for 30 days after Pro ends (taps to the Pro page); Manage opens Apple's subscription screen. App Store Connect: group AnoUlam Pro, `com.anoulam.app.pro.monthly` ₱99 and `com.anoulam.app.pro.yearly` ₱599, 3-day trials, 148 countries (no EU), 16-day grace period, server notifications to RevenueCat; see `docs/compliance.md`. | `revenuecat-webhook` (deployed, `--no-verify-jwt`, connected in RevenueCat for production and sandbox) writes `users.pro_until` on every subscription event; the database's saved-meals cap and daily limits use it through `is_pro()`. Device checks still to run: `docs/to-test.md`. Android not set up. The RevenueCat key (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`) is only in `.env`: add it as an EAS environment variable before any preview/production build. |
| "Your recipe could earn you Pro" sheet (2026-11-08) | Progress from the database: approved recipes (`meals.poster_id` + `status`) and the first photo post (`food_posts.image_url`), shown as "1 of 3 approved" / "Done", with only the days still to earn. The once-a-day / 3-dismissals record is on the account (`users.earn_pro_prompt`). Stops showing once everything is earned. | The Pro days themselves aren't granted: that's Pro rewards, which needs Pro on the account (Summary, item 5). Shown to free users. |
| Ingredients to avoid (Pro) | Saved to `users.preferences.avoid_ingredients`. Meals using one are left out of every list that follows preferences (Suggest by Budget and Pantry, Recommendations, Surprise me, Today's pick, moods, Related meals, Community Favorites, the Meal Planner). Browse search is the exception: they stay in the results, last and blurred, with "Manage avoided ingredients" and "View anyway" (`AvoidedMealCover`). An entry is one food by base name (raw and cooked alike) or a whole food: picking a chicken cut asks "All chicken (21 kinds)" or "Just chicken wing" (the word anywhere in the catalog name, plus the whole category when the word names one, e.g. pork covers lechon and sisig; egg items only match "egg"). The sheet shows a live "meals hidden" count, rows with each entry's meal count, common picks, and Undo; Settings shows them as chips. | Whole-food grouping is by catalog wording, so a few groups are broad ("All gourd", "All pepper"), offered rather than forced. |
| Nutrition goals (Pro) | Planning targets, no food logging. Set once with the guided setup (body stats, goal, recommended targets, adjustable) from Settings or the planner, saved to `users.preferences.nutrition_goals` (with the goal type). New plans aim at them and show each day's calories and macros against them; Home's planner card shows today vs the goals; meal cards get a "Fits your goals" tag (a serving within 20% of a third of the day's calories, with at least 85% of a third of the protein); Suggest by Budget has a "Best for my goals" sort; Meal Details shows one serving as a share of each goal. | Body stats stay on the phone. No logging of what was actually eaten (deliberately: plans stand in for it). The fit thresholds are a first guess. |
| Meal plan length (Pro) | Settings' inline 5 days / 7 days choice (`users.preferences.planner_defaults.days`). New plans are that long; the budget splits evenly across the days, and the grocery list, locked days, titles and weekly savings follow each plan's own length. | |
| Price alerts (Pro) | The Settings switch still saves (`users.preferences.price_alerts.enabled`). | **No surface right now**: the Price Watch card and tab dot were removed. Needs a new home (e.g. push, once developer accounts exist) or the switch and its paywall line removed. |
| Meal Planner | Real catalog only, within budget, following preferences and ingredients to avoid; each meal fills the slots its meal-time tags say (fast food and untagged meals aren't planned). Saved to the account with its grocery ticks. | The planner isn't locked for free users (only the days after the first are). |

## Not integrated

| Area | Status |
| --- | --- |
| Push notifications | None (needs developer accounts). |

## Built but not deployed

| Item | What's needed |
| --- | --- |
| `delete-account` edge function | Deploy it (`supabase functions deploy delete-account`); not in the deployed list on 2026-11-06. It also removes the user's post photos. |
| `ingest-da-daily-prices` | Redeploy: the live version (v3, 2026-10-10 04:23 UTC) predates the code's last change (2026-10-10 08:38 UTC), so it may not accept the PDF the app now sends itself (DA blocks server downloads). A daily automatic import isn't possible as built: the function only parses, saving needs an admin, and DA blocks server-side PDF downloads. |

## Before release

- **RLS lockdown**: the `TEMP: anyone can update` policies, and users being able to set their own `tier` on `users`. When narrowing what users can update on their own row, keep `seen_intros`, `preferences`, display name, avatar, bio and the two profile settings editable.
- **Edge functions**: admin checks on the admin-only ones.
- **Subscriptions**: add `EXPO_PUBLIC_REVENUECAT_IOS_KEY` as an EAS environment variable (`.env` isn't uploaded to EAS; dev builds read it from Metro). Each subscription needs its review screenshot in App Store Connect, and the first subscription group goes to review with an app version. Keep the EU off (`docs/compliance.md`). The paywall still promises price drop alerts and weekly savings, which have no surface.
- **Klipy**: move the API key behind a proxy.
- **Community moderation**: reporting and admin removal are built (not yet tested on a device); posts still go live at once (no pre-review), and nobody is notified of a report or a removal.
- **Native sign-in**: native Google sign-in (instead of the browser flow). Apple sign-in is built (2026-11-08, native sheet + `signInWithIdToken`, Supabase Apple provider on with client ID `com.anoulam.app`); App Review requires it alongside Google, so test it on a device before submitting.
- **Google sign-in URL looks sketchy**: the Google screen says it's continuing to `ykrultxqfxgyiziqrrgp.supabase.co`, the raw Supabase project address. Fix with native Google sign-in (Google then shows the app name), or a Supabase custom domain such as `auth.anoulam.com` (paid add-on), plus the app name, logo and support email on the Google Cloud OAuth consent screen.
- **Supabase Site URL**: still `http://localhost:3000`, which is where a rejected redirect lands. Set it to a real page before release.
- **Paywall promises**: price drop alerts and weekly savings are on the paywall but have no surface now; the rest are built and need real Pro (subscriptions) to reach paying users.
- **OpenAI models**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**. Nearly every edge function uses `gpt-4o-mini`.
- **Dev-only shortcuts to remove**:
  - the "act signed in" switches in Browse and other users' profiles;
  - "End Pro now (test)" in Manage your plan, and the TEST labels on the checkout (go with real subscriptions);
  - the iPad letterbox in `app/_layout.tsx`.
