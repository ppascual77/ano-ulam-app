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
| Grocery list | Built from the user's real saved meals; "Have" tags read the real pantry. Checkboxes saved to `grocery_checks` per account (taps are instant and batched: sent when leaving the tab, closing the list, or backgrounding the app). A check made at another quantity reads as unchecked (restock). | `api/groceryChecks.ts`, `core/grocery/hooks/useSavedGroceryList.ts` |
| Suggest by Pantry | "What can you make?" matches the real pantry against the real catalog (count, match %, See meals results grouped by how ready they are to cook). | `core/pantry/hooks/usePantryMatches.ts`, `features/pantry` |
| Suggest by Budget | Real meals whose cost for the chosen servings is within **10%** of the budget (₱300 means ₱270 to ₱330), full price, closest first. Follows preferences; the **Categories** tiles (Breakfast, Lunch, Dinner by meal-time tag, Fastfood) filter the rows. 5 at a time with a "Show More Meals" card; a clear-budget chip returns to Home. Empty state uses onboarding slide 1's art. | `core/budget/utils/budgetMatch.ts`, `core/budget/components/MealSuggestion.tsx` |
| Recommendations | 10 random real meals; with a Home Categories tile picked, every meal in that category. Follows preferences. 5 at a time with a Show More card (no See All). | `core/meals/hooks/useRecommendedMeals.ts` |
| Surprise me (Home pull-down) | Lands on a random real meal that fits the user's preferences; View Details loads the full meal. Only appears once there's a real meal to land on. | `features/home/components/RandomMealPuller.tsx`, `core/meals/hooks/usePreferredMeals.ts` |
| Today's pick (Browse) | One real home-cooked meal a day (with a photo when possible), the same all day, by date. Follows preferences. | `features/browse/hooks/useTodaysPick.ts` |
| Ulam moods (Browse) | Real meals by per-serving rule: Tipid under ₱150, High Protein 30g+, Quick & Easy 20 min or less. Follows preferences. | `features/browse/components/MoodSelection.tsx` |
| Related meals (Meal Detail) | The web server's logic on the real catalog: same category and protein ("More pork meals"), else other user recipes, else shared tags. Up to 8; opens the full meal. | `core/meals/components/detail/RelatedMeals.tsx` |
| Community Favorites (Home) | The top 10 most-saved real meals (only meals someone saved; hidden until there are some), following preferences. 5 at a time. | `core/budget/components/CommunityFavoritesSection.tsx` |
| Meal list ("See all") | Real meals. From Suggest by Budget: priced for the servings, with Quick Filters (protein and style chips, any chip matches). From This week's best value meals: its own card, no filters. Recommendations and Community Favorites have no See All (5 at a time with Show More). | `features/meals/screens/MealListScreen.tsx` |
| Meal popularity (saves) | Saves are the popularity signal, no separate likes. Each meal's `save_count` is kept by a database trigger on `saved_meals`; shown under the bookmark on meal cards and the Discover rail, and as a saved pill in Meal Details. Your own save moves the count right away. Migration `20261101020000` (drops the old `meal_likes` and `like_count`). | `core/saved/hooks/useSavedMeals.ts`, `core/meals/components/card/MealCard.tsx` |
| Profile | Name and avatar from the session; Saved, Created recipes and Pantry are real. Bio (`users.bio`, 50 characters, checked by the database) and the two settings, "Show saved meals on your profile" (`users.show_saved_public`) and "Email newsletter" (`users.newsletter_subscribed`, off by default, saved only: nothing sends emails yet). Migration `20261101030000`. The meal plan banner stays hidden until the Meal Planner can save a plan. | `features/profile/hooks/useProfile.ts`, `api/auth.ts` |
| Other users' profiles | Real users (recipe posters): name, avatar, bio, approved recipes, and their saved meals when they made them public. Read through two database functions, `get_public_profile` and `get_public_saved_meals` (signed-in only, nothing private returned), so `users` and `saved_meals` RLS stay owner-only. The mock Community authors keep fixtures (`features/profile/mock/users.ts`) until the feed is real. | `api/profiles.ts`, `features/profile/screens/UserProfileScreen.tsx` |
| Page intros | Play once per page, per account: seen intros saved to `users.seen_intros` (migration `20261101010000`) and on the phone; a guest's are merged into the account on sign-in. Settings' "Replay page intros" clears both. | `core/preferences/store/useSeenIntrosStore.ts`, `api/auth.ts` |
| User recipes | Add a Recipe, then pending, then admin approval in Review Recipes. | `api/recipes.ts` |
| Admin tools | Manage Meals and Ingredients, Seed Meal, import from URL, AI meal images, ingredient verification, DA linking. | `features/admin`, edge fns `import-meal-from-url`, `generate-meal-image` |
| Meal seeding | The `/seed-meal` skill writes real meals and `meal_sources`. | `.claude/skills/seed-meal` |
| GIF picker | Klipy API (the key is still in the app, see Before release). | `api/klipy.ts` |

## Partly integrated

| Area | Real | Not real yet |
| --- | --- | --- |
| Meal Planner | Uses real meals (TEMP flag `PLAN_WITH_REAL_MEALS_ONLY` is on). | Also a **mock catalog** (`features/meal-planner/mock/plannerMeals.ts`). The plan is stored **on the phone only**, and so are its grocery checkboxes. Planner defaults and nutrition goals aren't applied. |
| Daily limits | Work for searches (10 a day), Suggest by Budget (5) and Suggest by Pantry (5); guests get 3. | Counted **on the phone only**, so no server check. Reinstalling resets them. |

## Not integrated

| Area | Status |
| --- | --- |
| Community feed and Food Posts | Fully mock: posts, authors, likes, comments (`core/posts/mock/posts.ts`). No `food_posts` table. |
| Pro subscription | `isPro` is a test switch that resets on reload (`core/pro/store/useProStore.ts`). No subscriptions or payments; `users.tier` isn't set by anything. |
| Pro features on the paywall | Price drop alerts, weekly savings in pesos, the ingredients-to-avoid filter and nutrition goals are **not built** (settings only). The avoid filter is in git history: commit `9e0c3dc`, `useAvoidFilter`. |
| Pro rewards | 7 days of Pro per approved recipe (up to 3), 2 days for the first photo post. **Not built**; needs real Pro accounts. |
| "Your recipe could earn you Pro" sheet | Works, but its counter is on the phone and it can't tell when rewards are claimed. |
| Apple sign-in | Not built (needs a paid Apple Developer account). |
| Push notifications | None. |

## Built but not deployed

| Item | What's needed |
| --- | --- |
| `delete-account` edge function | Deploy it (`supabase functions deploy delete-account`). |
| `ingest-da-daily-prices` | May need a redeploy, plus a daily DA cron schedule. |

## Before release

- **RLS lockdown**: the `TEMP: anyone can update` policies, and users being able to set their own `tier` on `users`. When narrowing what users can update on their own row, keep `seen_intros` (and display name, avatar, preferences) editable.
- **Edge functions**: admin checks on the admin-only ones.
- **Klipy**: move the API key behind a proxy.
- **Native sign-in**: native Google sign-in (instead of the browser flow) and Apple sign-in.
- **Paywall promises**: build price alerts, savings, avoid ingredients and nutrition goals, or take them off the paywall.
- **OpenAI models**: `gpt-4o-mini` and `gpt-4o` shut down on **2027-01-14**. Nearly every edge function uses `gpt-4o-mini`.
- **Dev-only shortcuts to remove**:
  - the "act signed in" switches in Browse, Discover and other users' profiles;
  - the extra mock posts by "me";
  - the iPad letterbox in `app/_layout.tsx`.

## Suggested order

1. **Meal Planner** (next): drop the mock catalog, save plans (and their grocery checks) to the account.
2. **Community feed**: `food_posts` (public profiles are ready for its authors).
3. **Pro for real**: subscriptions, `tier`, then rewards and the paywall features.
