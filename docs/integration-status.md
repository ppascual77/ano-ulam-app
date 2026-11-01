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
| Account and preferences | The `users` row: name, avatar, dietary focus, allergens, and the four Pro settings (saved, not yet acted on). | `api/auth.ts`, `core/preferences` |
| Meals catalog | `meals` and `meal_ingredients`: Discover reel, Browse search, Recommendations, Best Value meals, Meal Detail. | `api/meals.ts` |
| Ingredients and nutrition | `ingredients` grounded from USDA and FNRI, macros and micronutrients per meal, verification locks. | `api/ingredients.ts`, edge fns `ground-ingredients-usda`, `estimate-ingredient-ai`, `verify-meal-ingredients` |
| Prices | DA daily price import, store listings, AI pack estimates, Price Watch, weekly price changes. | `api/daPrices.ts`, `api/priceWatch.ts`, `api/storeListings.ts`, edge fns `ingest-da-daily-prices`, `ground-ingredient-prices`, `estimate-pack-sizes` |
| Saved meals | `saved_meals`: save and unsave everywhere, servings updates. Database limit: 10 for free, 500 for `tier = 'pro'` (migration `20261031000000`, applied). | `api/saved.ts`, `core/saved` |
| Pantry | `pantry_items` (owner-only). A guest's pantry is kept on the phone and merged into the account on the first load after sign-in. **On branch `feat/pantry-backend`, not merged to `main` yet.** | `api/pantry.ts`, `core/pantry/hooks/usePantry.ts` |
| Suggest by Pantry | "What can you make?" matches the real pantry against the real catalog (count, match %, See meals results grouped by how ready they are to cook). | `core/pantry/hooks/usePantryMatches.ts`, `features/pantry` |
| User recipes | Add a Recipe, then pending, then admin approval in Review Recipes. | `api/recipes.ts` |
| Admin tools | Manage Meals and Ingredients, Seed Meal, import from URL, AI meal images, ingredient verification, DA linking. | `features/admin`, edge fns `import-meal-from-url`, `generate-meal-image` |
| Meal seeding | The `/seed-meal` skill writes real meals and `meal_sources`. | `.claude/skills/seed-meal` |
| GIF picker | Klipy API (the key is still in the app, see Before release). | `api/klipy.ts` |

## Partly integrated

| Area | Real | Not real yet |
| --- | --- | --- |
| Grocery list | Built from the user's real saved meals; "Have" tags read the real pantry. | **Checkboxes are in memory** (`core/grocery/mock/checks.ts`). The `grocery_checks` table **already exists on the database** (migration `20261026020000`), so only the app side is left. |
| Meal Planner | Uses real meals (TEMP flag `PLAN_WITH_REAL_MEALS_ONLY` is on). | Also a **mock catalog** (`features/meal-planner/mock/plannerMeals.ts`). The plan is stored **on the phone only**. Planner defaults and nutrition goals aren't applied. |
| Discover | The reel is real meals; saves are real. | **Likes are in memory** (`features/discover/mock/api.ts`). |
| Profile | Name and avatar from the session; Saved, Created recipes and Pantry are real. | **Bio** and the **saved meal plan banner** are mock (`features/profile/mock/api.ts`). |
| Home, Budget mode | Recommendations and Best Value meals. | **Community Favorites** and the **Surprise me** puller use mock meals (`core/meals/mocks/meals.ts`). Suggest by Budget is its own row under Not integrated. |
| Meal Detail | Everything about the meal itself. | **Related meals** are the mock list. |
| Browse | Search and filters on real meals. | **Today's pick** and the **mood carousels** are mock (`features/browse/mocks/moodMeals.ts`). |
| Meal list ("See all") | Real meals. | Mixed with mock meals. |
| Daily limits | Work for searches (10 a day), Suggest by Budget (5) and Suggest by Pantry (5); guests get 3. | Counted **on the phone only**, so no server check. Reinstalling resets them. |
| Page intros | Play once per page. | "Seen" is remembered **on the phone**, not on the account. |

## Not integrated

| Area | Status |
| --- | --- |
| Suggest by Budget | The budget isn't used to pick meals; it's only shown as a label chip, and servings are ignored. Results are always the mock meal list (`core/meals/mocks/meals.ts`), narrowed only by the filter chips, after a fixed 2-second "thinking" delay. Needs: real meals that fit the budget per serving for the chosen servings. Its daily limit (5) already works. |
| Community feed and Food Posts | Fully mock: posts, authors, likes, comments (`core/posts/mock/posts.ts`). No `food_posts` table. |
| Other users' profiles | Mock fixtures (`features/profile/mock/users.ts`). `users` RLS only lets a user read their own row, so a readable public profile is needed. |
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

- **RLS lockdown**: the `TEMP: anyone can update` policies, and users being able to set their own `tier` on `users`.
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

1. **Grocery checkboxes**: the table already exists, so it's a small app-side swap, like the pantry.
2. **Suggest by Budget**: Home's main feature, and the one whose results are the least real. Pick real meals that fit the budget for the chosen servings.
3. **Home and Browse mock sections**: Community Favorites, Surprise me, Today's pick, moods, Related meals. All of these can read the real catalog.
4. **Discover likes**: a likes table plus `like_count`.
5. **Meal Planner**: drop the mock catalog, save plans to the account.
6. **Community feed**: `food_posts`, then public profiles.
7. **Pro for real**: subscriptions, `tier`, then rewards and the paywall features.
