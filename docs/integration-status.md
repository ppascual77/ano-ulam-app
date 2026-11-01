# Integration status

What runs on real data, what's partly real, and what's still mock or unbuilt, across the whole app.

Last updated: **2026-11-01**. Update this file whenever something moves between sections.

**Legend**

- **Integrated**: reads and writes real data (Supabase, or a real external source).
- **Partly integrated**: some of it is real, some is mock, in memory, or only on the phone.
- **Not integrated**: mock only, or not built yet.
- **In memory**: resets when the app reloads. **On the phone**: survives reloads (AsyncStorage), but not reinstalls or other devices.

---

## Integrated

| Area | What's real | Where |
| --- | --- | --- |
| Sign-in | Google OAuth through Supabase Auth. In Expo Go it only works when served with `npm run tunnel` ([supabase/auth#2039](https://github.com/supabase/auth/issues/2039)). | `api/auth.ts` |
| Account and preferences | The `users` row: name, avatar, dietary focus, allergens, and the four Pro settings (saved, not yet acted on). Dietary focus and allergens **filter Suggest by Budget and Recommendations** (allergens always left out; vegetarian accepts vegan, pescatarian accepts both). | `api/auth.ts`, `core/preferences`, `core/budget/utils/budgetMatch.ts` |
| Meals catalog | `meals` and `meal_ingredients`: Discover reel, Browse search (with a Protein Source filter), Recommendations, Best Value meals, Meal Detail. Opening a meal from any list loads the full meal first, so ingredients and micronutrients always show. | `api/meals.ts`, `core/meals/hooks/useFullMeal.ts` |
| Ingredients and nutrition | `ingredients` grounded from USDA and FNRI, macros and micronutrients per meal, verification locks. | `api/ingredients.ts`, edge fns `ground-ingredients-usda`, `estimate-ingredient-ai`, `verify-meal-ingredients` |
| Prices | DA daily price import, store listings, AI pack estimates, Price Watch, weekly price changes. | `api/daPrices.ts`, `api/priceWatch.ts`, `api/storeListings.ts`, edge fns `ingest-da-daily-prices`, `ground-ingredient-prices`, `estimate-pack-sizes` |
| Saved meals | `saved_meals`: save and unsave everywhere, servings updates. Database limit: 10 for free, 500 for `tier = 'pro'` (migration `20261031000000`, applied). | `api/saved.ts`, `core/saved` |
| Pantry | `pantry_items` (owner-only). A guest's pantry is kept on the phone and merged into the account on the first load after sign-in. Profile's Pantry tab reuses Home's pantry section. | `api/pantry.ts`, `core/pantry/hooks/usePantry.ts` |
| Grocery list | Built from the user's real saved meals; "Have" tags read the real pantry. Checkboxes saved to `grocery_checks` per account and list (saved meals or meal plan) (taps are instant and batched: sent when leaving the tab, closing the list, or backgrounding the app). A check made at another quantity reads as unchecked (restock). | `api/groceryChecks.ts`, `core/grocery/hooks/useSavedGroceryList.ts` |
| Suggest by Pantry | "What can you make?" matches the real pantry against the real catalog (count, match %, See meals results grouped by how ready they are to cook). | `core/pantry/hooks/usePantryMatches.ts`, `features/pantry` |
| Suggest by Budget | Real meals whose cost for the chosen servings is within **10%** of the budget (₱300 means ₱270 to ₱330), full price, closest first. Follows preferences; the **Categories** tiles (Breakfast, Lunch, Dinner by meal-time tag, Fastfood) filter the rows. 5 at a time with a "Show More Meals" card; a clear-budget chip returns to Home. Empty state uses onboarding slide 1's art. | `core/budget/utils/budgetMatch.ts`, `core/budget/components/MealSuggestion.tsx` |
| Recommendations | 10 random real meals; with a Home Categories tile picked, every meal in that category. Follows preferences. 5 at a time with a Show More card (no See All). | `core/meals/hooks/useRecommendedMeals.ts` |
| Surprise me (Home pull-down) | Lands on a random real meal that fits the user's preferences; View Details loads the full meal. Only appears once there's a real meal to land on. | `features/home/components/RandomMealPuller.tsx`, `core/meals/hooks/usePreferredMeals.ts` |
| Today's pick (Browse) | One real home-cooked meal a day (with a photo when possible), the same all day, by date. Follows preferences. | `features/browse/hooks/useTodaysPick.ts` |
| Ulam moods (Browse) | Real meals by per-serving rule: Tipid under ₱150, High Protein 30g+, Quick & Easy 20 min or less. Follows preferences. | `features/browse/components/MoodSelection.tsx` |
| Related meals (Meal Detail) | The web server's logic on the real catalog: same category and protein ("More pork meals"), else other user recipes, else shared tags. Up to 8; opens the full meal. | `core/meals/components/detail/RelatedMeals.tsx` |
| Community Favorites (Home) | The top 10 most-saved real meals (only meals someone saved; hidden until there are some), following preferences. 5 at a time. | `core/budget/components/CommunityFavoritesSection.tsx` |
| Meal list ("See all") | Real meals. From Suggest by Budget: priced for the servings. From This week's best value meals: its own card. No filters. Recommendations and Community Favorites have no See All (5 at a time with Show More). | `features/meals/screens/MealListScreen.tsx` |
| Meal popularity (saves) | Saves are the popularity signal, no separate likes. Each meal's `save_count` is kept by a database trigger on `saved_meals`; shown under the bookmark on meal cards and the Discover rail, and as a saved pill in Meal Details. Your own save moves the count right away. Migration `20261101020000` (drops the old `meal_likes` and `like_count`). | `core/saved/hooks/useSavedMeals.ts`, `core/meals/components/card/MealCard.tsx` |
| Profile | Name and avatar from the session; Saved, Created recipes and Pantry are real. Bio (`users.bio`, 50 characters, checked by the database) and the two settings, "Show saved meals on your profile" (`users.show_saved_public`) and "Email newsletter" (`users.newsletter_subscribed`, off by default, saved only: nothing sends emails yet). Migration `20261101030000`. The meal plan banner stays hidden until the Meal Planner can save a plan. | `features/profile/hooks/useProfile.ts`, `api/auth.ts` |
| Other users' profiles | Real users (recipe posters and post authors): name, avatar, bio, approved recipes, food posts, and their saved meals when they made them public. Read through two database functions, `get_public_profile` and `get_public_saved_meals` (signed-in only, nothing private returned), so `users` and `saved_meals` RLS stay owner-only. | `api/profiles.ts`, `features/profile/screens/UserProfileScreen.tsx` |
| Community feed and Food Posts | `food_posts` and `food_post_likes` (migration `20261101060000`, **not applied yet**). Discover's Community tab (5 at a time, pull to refresh) and each profile's Food Posts (10 at a time) read through `get_food_posts`, which adds the author's name and avatar, the live like count and your like (signed-in only, so `users` stays owner-only). Post, edit and delete your own (RLS); photos upload to the `post-images` bucket under your own folder and are removed with the post; links get a preview read from the page's Open Graph tags on the phone (hostname if it can't be read). Likes are optimistic and show the same in the feed and on profiles. No comments (the mobile app never had them). | `api/posts.ts`, `core/posts/hooks/usePosts.ts` |
| Meal plans | One current plan per account (`meal_plans`, owner-only, migration `20261101040000`): the inputs plus the meal id in each slot per day, rebuilt from the catalog when opened. Saved after building, regenerating a day or swapping a meal. A running plan reopens as it was; an ended one (or one whose meal left the catalog) goes back to setup with the budget, people and goal filled in. Its grocery ticks are the `plan` list, cleared when a new plan is built. Guests plan in memory only. | `api/mealPlans.ts`, `features/meal-planner/hooks/useSavedMealPlan.ts`, `core/grocery/hooks/useGroceryChecks.ts` |
| Daily limits | Searches (10 a day), Suggest by Budget (5) and Suggest by Pantry (5) for free accounts, counted per account in `daily_usage` (migration `20261101050000`) through `count_daily_use`, so reinstalling or another phone doesn't reset them. A Philippine day; repeats and refinements are free; `tier = 'pro'` is unlimited. Guests (3 each) count on the phone. If the server can't be reached the use is allowed. Still a soft limit: searches read the catalog directly. | `api/dailyUsage.ts`, `core/pro/dailyLimits.ts` |
| Page intros | Play once per page, per account: seen intros saved to `users.seen_intros` (migration `20261101010000`) and on the phone; a guest's are merged into the account on sign-in. Settings' "Replay page intros" clears both. | `core/preferences/store/useSeenIntrosStore.ts`, `api/auth.ts` |
| User recipes | Add a Recipe, then pending, then admin approval in Review Recipes. | `api/recipes.ts` |
| Admin tools | Manage Meals and Ingredients, Seed Meal, import from URL, AI meal images, ingredient verification, DA linking. | `features/admin`, edge fns `import-meal-from-url`, `generate-meal-image` |
| Meal seeding | The `/seed-meal` skill writes real meals and `meal_sources`. | `.claude/skills/seed-meal` |
| GIF picker | Klipy API (the key is still in the app, see Before release). | `api/klipy.ts` |

## Partly integrated

| Area | Real | Not real yet |
| --- | --- | --- |
| Pro features on the paywall | Built and working behind the mock subscription (`isPro`, see Pro subscription), from the real Pro settings in `users.preferences`. **Ingredients to avoid**: meals using one are left out of every list that follows preferences (Suggest by Budget and Pantry, Recommendations, Browse search, Surprise me, Today's pick, moods, Related meals, Community Favorites, the Meal Planner), matched by ingredient id. **Nutrition goals**: Meal Details shows one serving as a share of each goal; the planner's macro card offers "Use my nutrition goals" (needs calories and protein). **Price alerts** (in-app, one on/off switch in Settings): each day DA reports, the biggest drops in that report (up to 5, week over week) show at the top of Price Watch, with a dot on its tab until that day's alert is seen (seen state on the phone). **Weekly savings**: a Price Watch card with what the running meal plan (else saved meals) costs less at this week's DA prices than last week's, and the top meals; free accounts see a locked teaser. | Only as real as `isPro` (a mock subscription on the phone). No push notifications for price drops. Savings only count DA-linked ingredients and are an estimate, like Best Value meals. |
| Meal Planner | Real catalog only, within budget, following preferences; each meal fills the slots its meal-time tags say (fast food and untagged meals aren't planned). The plan is saved to the account (`meal_plans`) and its grocery ticks too. | The Pro settings (planner defaults, nutrition goals) don't prefill setup yet, and the planner isn't locked for free users (only days 2 to 5 are). Body stats in the macro sheet stay on the phone. |

## Not integrated

| Area | Status |
| --- | --- |
| Pro subscription | **Mocked end to end, on the phone only** (`core/pro/store/useProStore.ts`, AsyncStorage): the Pro page's trial button opens a test checkout sheet (trial timeline, "no payment is taken"), then a plain white unlock screen (the padlock opens, then what Pro now includes). Settings shows the plan card (plan, status, next charge or end date, days left) and Manage your plan: switch Monthly/Yearly (confirmed first: now during the trial, at the next renewal on a paid plan, shown as "Starts <date>"), cancel (one plain confirmation; Pro stays on until the period ends), resume, and "End Pro now (test)". Trials roll into active and cancelled plans end by date. No real subscriptions or payments (needs developer accounts); `users.tier` isn't set by anything (the app skips the daily-limit check while mock Pro is on; saved meals past 10 are still refused by the database's free limit). |
| Pro rewards | 7 days of Pro per approved recipe (up to 3), 2 days for the first photo post. **Not built**; needs real Pro accounts (photo posts are real now). |
| "Your recipe could earn you Pro" sheet | Works, but its counter is on the phone and it can't tell when rewards are claimed. |
| Apple sign-in | Not built (needs a paid Apple Developer account). |
| Push notifications | None. |

## Built but not deployed

| Item | What's needed |
| --- | --- |
| `food_posts` migration | Apply `20261101060000_food_posts.sql` (tables, `get_food_posts`, the `post-images` bucket). The Community tab shows "Couldn't load" until then. |
| `delete-account` edge function | Deploy it (`supabase functions deploy delete-account`). It now also removes the user's post photos. |
| `ingest-da-daily-prices` | May need a redeploy, plus a daily DA cron schedule. |

## Before release

- **RLS lockdown**: the `TEMP: anyone can update` policies, and users being able to set their own `tier` on `users`. When narrowing what users can update on their own row, keep `seen_intros` (and display name, avatar, preferences) editable.
- **Edge functions**: admin checks on the admin-only ones.
- **Klipy**: move the API key behind a proxy.
- **Community moderation**: posts go live at once, with no report or hide. Add reporting (and an admin way to remove a post) before opening the feed to the public.
- **Native sign-in**: native Google sign-in (instead of the browser flow) and Apple sign-in.
- **Paywall promises**: price alerts, savings, avoid ingredients and nutrition goals are built; they need real Pro (subscriptions) to reach paying users.
- **OpenAI models**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**. Nearly every edge function uses `gpt-4o-mini`.
- **Dev-only shortcuts to remove**:
  - the "act signed in" switches in Browse and other users' profiles (Discover's Community one is gone: the real feed needs a session);
  - the iPad letterbox in `app/_layout.tsx`.

## Suggested order

1. **Pro for real** (next): subscriptions, `tier`, then rewards and the paywall features (including the Meal Planner's lock and its Pro settings prefill).
