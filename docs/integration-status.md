# Integration status

What runs on real data, what's partly real, and what's still mock or unbuilt, across the whole app.

Last updated: **2026-11-01**. Update this file whenever something moves between sections.

**Legend**

- **Integrated**: reads and writes real data (Supabase, or a real external source).
- **Partly integrated**: some of it is real, some is mock, in memory, or only on the phone.
- **Not integrated**: mock only, or not built yet.
- **In memory**: resets when the app reloads. **On the phone**: survives reloads (AsyncStorage), but not reinstalls or other devices.

---

## Summary

### Done in the latest round

- **Community feed and Food Posts** are real (`food_posts`, likes, photo uploads, link previews). The migration still has to be applied (see Built but not deployed).
- **Pro features are built**, working behind a mock subscription: ingredients to avoid (one food or a whole food), nutrition goals (as planning targets across the app), daily price alerts (one switch), weekly savings, and a 5 or 7 day meal plan length.
- **The Pro subscription is mocked end to end**: test checkout, unlock screen, a plan card in Settings, switching plans (confirmed, scheduled at renewal on a paid plan), cancelling and resuming, "See all Pro features".
- **Home's planner card follows your plan**: "Plan your week", "Today's plan" (today's meals, day N of M, the day vs your goals) or "Plan next week".

### What's left, in order

**Doable now (no developer accounts needed)**

1. **Apply the `food_posts` migration** and **deploy `delete-account`** (deploy steps, no code).
2. **OpenAI model migration**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**; nearly every edge function uses `gpt-4o-mini`.
3. **Security before release**: RLS lockdown (the `TEMP: anyone can update` policies, users setting their own `tier`), admin checks on admin-only edge functions, the Klipy key behind a proxy.
4. **Community moderation**: reporting, and an admin way to remove a post.
5. **Pro on the account instead of the phone** (see Pro subscription): a `pro_until` on `users`, set only by the database, so Pro survives reinstalls, the database's saved-meals limit and daily limits honour it, and **Pro rewards** become buildable (7 days per approved recipe, 2 for the first photo post).
6. **Small leftovers**: the Meal Planner isn't locked for free users (only days after the first are); Profile's `MealPlanBanner` is unused (remove it, or show the saved plan there); "Your recipe could earn you Pro" counts on the phone.

**Needs developer accounts (skipped for now)**

- Real subscriptions and payments (App Store and Google Play billing, e.g. through RevenueCat, then a webhook that sets Pro on the account).
- Apple sign-in, native Google sign-in.
- Push notifications (e.g. sending the daily price alert to the phone).

---

## Integrated

| Area | What's real | Where |
| --- | --- | --- |
| Sign-in | Google OAuth through Supabase Auth. In Expo Go it only works when served with `npm run tunnel` ([supabase/auth#2039](https://github.com/supabase/auth/issues/2039)). | `api/auth.ts` |
| Account and preferences | The `users` row: name, avatar, dietary focus, allergens, and the Pro settings in `users.preferences` (ingredients to avoid, nutrition goals, meal plan length, price alerts; acted on while Pro, see Partly integrated). Dietary focus and allergens **filter every "for you" list** (allergens always left out; vegetarian accepts vegan, pescatarian accepts both). | `api/auth.ts`, `core/preferences`, `core/budget/utils/budgetMatch.ts` |
| Meals catalog | `meals` and `meal_ingredients`: Discover reel, Browse search (with a Protein Source filter), Recommendations, Best Value meals, Meal Detail. Opening a meal from any list loads the full meal first, so ingredients and micronutrients always show. | `api/meals.ts`, `core/meals/hooks/useFullMeal.ts` |
| Ingredients and nutrition | `ingredients` grounded from USDA and FNRI, macros and micronutrients per meal, verification locks. | `api/ingredients.ts`, edge fns `ground-ingredients-usda`, `estimate-ingredient-ai`, `verify-meal-ingredients` |
| Prices | DA daily price import (Admin; the app downloads DA's PDF and the edge function parses it), store listings, AI pack estimates, Price Watch, weekly price changes. | `api/daPrices.ts`, `api/priceWatch.ts`, `api/storeListings.ts`, edge fns `ingest-da-daily-prices`, `ground-ingredient-prices`, `estimate-pack-sizes` |
| Saved meals | `saved_meals`: save and unsave everywhere, servings updates. Database limit: 10 for free, 500 for `tier = 'pro'` (migration `20261031000000`, applied). | `api/saved.ts`, `core/saved` |
| Pantry | `pantry_items` (owner-only). A guest's pantry is kept on the phone and merged into the account on the first load after sign-in. Profile's Pantry tab reuses Home's pantry section. | `api/pantry.ts`, `core/pantry/hooks/usePantry.ts` |
| Grocery list | Built from the user's real saved meals, or the meal plan (every day of it for Pro); "Have" tags read the real pantry. Checkboxes saved to `grocery_checks` per account and list (taps are instant and batched: sent when leaving the tab, closing the list, or backgrounding the app). A check made at another quantity reads as unchecked (restock). | `api/groceryChecks.ts`, `core/grocery/hooks/useSavedGroceryList.ts` |
| Suggest by Pantry | "What can you make?" matches the real pantry against the real catalog (count, match %, See meals results grouped by how ready they are to cook). | `core/pantry/hooks/usePantryMatches.ts`, `features/pantry` |
| Suggest by Budget | Real meals whose cost for the chosen servings is within **10%** of the budget (₱300 means ₱270 to ₱330), full price, closest first (or "Best for my goals" with nutrition goals). Follows preferences; the **Categories** tiles (Breakfast, Lunch, Dinner by meal-time tag, Fastfood) filter the rows. 5 at a time with a "Show More Meals" card; a clear-budget chip returns to Home. | `core/budget/utils/budgetMatch.ts`, `core/budget/components/MealSuggestion.tsx` |
| Recommendations | 10 random real meals; with a Home Categories tile picked, every meal in that category. Follows preferences. 5 at a time with a Show More card (no See All). | `core/meals/hooks/useRecommendedMeals.ts` |
| Surprise me (Home pull-down) | Lands on a random real meal that fits the user's preferences; View Details loads the full meal. | `features/home/components/RandomMealPuller.tsx`, `core/meals/hooks/usePreferredMeals.ts` |
| Today's pick (Browse) | One real home-cooked meal a day (with a photo when possible), the same all day, by date. Follows preferences. | `features/browse/hooks/useTodaysPick.ts` |
| Ulam moods (Browse) | Real meals by per-serving rule: Tipid under ₱150, High Protein 30g+, Quick & Easy 20 min or less. Follows preferences. | `features/browse/components/MoodSelection.tsx` |
| Related meals (Meal Detail) | Same category and protein ("More pork meals"), else other user recipes, else shared tags. Up to 8; opens the full meal. | `core/meals/components/detail/RelatedMeals.tsx` |
| Community Favorites (Home) | The top 10 most-saved real meals (hidden until there are some), following preferences. 5 at a time. | `core/budget/components/CommunityFavoritesSection.tsx` |
| Meal list ("See all") | Real meals. From Suggest by Budget: priced for the servings. From This week's best value meals: its own card. No filters. | `features/meals/screens/MealListScreen.tsx` |
| Meal popularity (saves) | Saves are the popularity signal. Each meal's `save_count` is kept by a database trigger on `saved_meals`; shown under the bookmark on meal cards and the Discover rail, and as a saved pill in Meal Details. Migration `20261101020000`. | `core/saved/hooks/useSavedMeals.ts`, `core/meals/components/card/MealCard.tsx` |
| Profile | Name and avatar from the session; Saved, Created recipes (with Food Posts) and Pantry are real. Bio (`users.bio`, 50 characters) and the settings "Show saved meals on your profile" (`users.show_saved_public`) and "Email newsletter" (`users.newsletter_subscribed`, saved only: nothing sends emails yet). Migration `20261101030000`. | `features/profile/hooks/useProfile.ts`, `api/auth.ts` |
| Other users' profiles | Real users (recipe posters and post authors): name, avatar, bio, approved recipes, food posts, and their saved meals when public. Read through `get_public_profile` and `get_public_saved_meals` (signed-in only, nothing private returned). | `api/profiles.ts`, `features/profile/screens/UserProfileScreen.tsx` |
| Community feed and Food Posts | `food_posts` and `food_post_likes` (migration `20261101060000`, **not applied yet**). Discover's Community tab (5 at a time, pull to refresh) and each profile's Food Posts (10 at a time) read through `get_food_posts` (author name and avatar, live like count, your like; signed-in only). Post, edit and delete your own (RLS); photos in the `post-images` bucket under your own folder, removed with the post; link previews from the page's Open Graph tags (hostname if unreadable). Optimistic likes. No comments. | `api/posts.ts`, `core/posts/hooks/usePosts.ts` |
| Meal plans | One current plan per account (`meal_plans`, owner-only, migration `20261101040000`): the inputs plus the meal id in each slot per day (5 or 7 days), rebuilt from the catalog when opened. Saved after building, regenerating a day or swapping a meal. A running plan reopens as it was; an ended one goes back to setup with the budget, people and goal filled in. Its grocery ticks are the `plan` list. Guests plan in memory only. | `api/mealPlans.ts`, `features/meal-planner/hooks/useSavedMealPlan.ts` |
| Home planner card | One card by state: "Plan your week" (no plan), "Today's plan" while a plan runs (today's three meals as overlapping photos, day N of M, and with nutrition goals the day's calories and protein vs them; opens the plan on today), "Plan next week" once it ends. Crossfades between states; a placeholder while the plan loads. Free plans show day 1 only. | `features/home/components/HomePlanCard.tsx`, `PlanWeekCard.tsx` |
| Daily limits | Searches (10 a day), Suggest by Budget (5) and Suggest by Pantry (5) for free accounts, counted per account in `daily_usage` (migration `20261101050000`). A Philippine day; repeats and refinements are free; Pro is unlimited. Guests (3 each) count on the phone. Still a soft limit: searches read the catalog directly. | `api/dailyUsage.ts`, `core/pro/dailyLimits.ts` |
| Page intros | Play once per page, per account: `users.seen_intros` (migration `20261101010000`) and on the phone. Settings' "Replay page intros" clears both. | `core/preferences/store/useSeenIntrosStore.ts`, `api/auth.ts` |
| User recipes | Add a Recipe, then pending, then admin approval in Review Recipes. | `api/recipes.ts` |
| Admin tools | Manage Meals and Ingredients, Seed Meal, import from URL, AI meal images, ingredient verification, DA linking and import. | `features/admin`, edge fns `import-meal-from-url`, `generate-meal-image` |
| Meal seeding | The `/seed-meal` skill writes real meals and `meal_sources`. | `.claude/skills/seed-meal` |
| GIF picker | Klipy API (the key is still in the app, see Before release). | `api/klipy.ts` |

## Partly integrated

Every row here works on real data, but is only as real as `isPro`, which comes from the **mock subscription on the phone** (see Pro subscription).

| Area | Real | Not real yet |
| --- | --- | --- |
| Ingredients to avoid (Pro) | Saved to `users.preferences.avoid_ingredients`. Meals using one are left out of every list that follows preferences (Suggest by Budget and Pantry, Recommendations, Browse search, Surprise me, Today's pick, moods, Related meals, Community Favorites, the Meal Planner). An entry is one food by base name (raw and cooked alike) or a whole food: picking a chicken cut asks "All chicken (21 kinds)" or "Just chicken wing" (the word anywhere in the catalog name, plus the whole category when the word names one, e.g. pork covers lechon and sisig; egg items only match "egg"). The sheet shows a live "meals hidden" count, rows with each entry's meal count, common picks, and Undo; Settings shows them as chips. | Mock Pro only. Whole-food grouping is by catalog wording, so a few groups are broad ("All gourd", "All pepper"), offered rather than forced. |
| Nutrition goals (Pro) | Planning targets, no food logging. Set once with the guided setup (body stats, goal, recommended targets, adjustable) from Settings or the planner, saved to `users.preferences.nutrition_goals` (with the goal type). New plans aim at them and show each day's calories and macros against them; Home's planner card shows today vs the goals; meal cards get a "Fits your goals" tag (a serving within 20% of a third of the day's calories, with at least 85% of a third of the protein); Suggest by Budget has a "Best for my goals" sort; Meal Details shows one serving as a share of each goal. | Mock Pro only. Body stats stay on the phone. No logging of what was actually eaten (deliberately: plans stand in for it). The fit thresholds are a first guess. |
| Meal plan length (Pro) | Settings' inline 5 days / 7 days choice (`users.preferences.planner_defaults.days`). New plans are that long; the budget splits evenly across the days, and the grocery list, locked days, titles and weekly savings follow each plan's own length. | Mock Pro only. |
| Price alerts (Pro) | One on/off switch (`users.preferences.price_alerts.enabled`). Each day DA reports, that report's biggest drops (up to 5, week over week) show at the top of Price Watch, with a dot on its tab until that day's alert is seen. | Mock Pro only. In-app only (no push). Seen state on the phone. |
| Weekly savings (Pro) | A Price Watch card: what the running meal plan (else saved meals) costs less at this week's DA prices than last week's, and the meals that moved most. Free accounts see a locked teaser. | Mock Pro only. An estimate: only DA-linked ingredients count, like Best Value meals. |
| Meal Planner | Real catalog only, within budget, following preferences and ingredients to avoid; each meal fills the slots its meal-time tags say (fast food and untagged meals aren't planned). Saved to the account with its grocery ticks. | The planner isn't locked for free users (only the days after the first are). |

## Not integrated

| Area | Status |
| --- | --- |
| Pro subscription | **Mocked end to end, on the phone only** (`core/pro/store/useProStore.ts`, AsyncStorage). The Pro page's trial button opens a test checkout (plan, trial timeline, "Due today ₱0.00", no payment taken), then a plain white unlock screen (the padlock opens, then what Pro includes). Settings shows a plan card (plan, status, next charge or end date, days left), "See all Pro features", and Manage your plan: switch Monthly/Yearly (confirmed first; now during the trial, at the next renewal on a paid plan, shown as "Starts <date>"), cancel (one plain confirmation; Pro stays on until the period ends), resume, and "End Pro now (test)". Trials roll into active, cancelled plans end by date. No real subscriptions or payments (needs developer accounts). `users.tier` isn't set by anything: the app skips daily limits while mock Pro is on, but the database still refuses saved meals past 10. |
| Pro rewards | 7 days of Pro per approved recipe (up to 3), 2 days for the first photo post. **Not built**; needs Pro on the account (see Summary, item 5). |
| "Your recipe could earn you Pro" sheet | Works, but its counter is on the phone and it can't tell when rewards are claimed. |
| Profile meal plan banner | `MealPlanBanner` exists but isn't shown anywhere (Home's planner card covers the running plan). Remove it, or show the saved plan on Profile. |
| Apple sign-in | Not built (needs a paid Apple Developer account). |
| Push notifications | None (needs developer accounts). |

## Built but not deployed

| Item | What's needed |
| --- | --- |
| `food_posts` migration | Apply `20261101060000_food_posts.sql` (tables, `get_food_posts`, the `post-images` bucket). The Community tab shows "Couldn't load" until then. |
| `delete-account` edge function | Deploy it (`supabase functions deploy delete-account`). It also removes the user's post photos. |
| `ingest-da-daily-prices` | Check the deployed version is current (the app sends the PDF itself because DA blocks server downloads); redeploy if Admin's DA import fails. A daily automatic import isn't possible as built: the function only parses, saving needs an admin, and DA blocks server-side PDF downloads. |

## Before release

- **RLS lockdown**: the `TEMP: anyone can update` policies, and users being able to set their own `tier` on `users`. When narrowing what users can update on their own row, keep `seen_intros`, `preferences`, display name, avatar, bio and the two profile settings editable.
- **Edge functions**: admin checks on the admin-only ones.
- **Klipy**: move the API key behind a proxy.
- **Community moderation**: posts go live at once, with no report or hide.
- **Native sign-in**: native Google sign-in (instead of the browser flow) and Apple sign-in.
- **Paywall promises**: every Pro feature on the paywall is built; they need real Pro (subscriptions) to reach paying users.
- **OpenAI models**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**. Nearly every edge function uses `gpt-4o-mini`.
- **Dev-only shortcuts to remove**:
  - the "act signed in" switches in Browse and other users' profiles;
  - "End Pro now (test)" in Manage your plan, and the TEST labels on the checkout (go with real subscriptions);
  - the iPad letterbox in `app/_layout.tsx`.
