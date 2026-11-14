# Device checklist: iPhone + Android

What can be tested **now**, side by side. Tick `[x]` as you go. `n/a` = not possible on that phone yet.
Use the newest builds: iPhone TestFlight (or the dev build), Android dev build (or the preview `.apk`).
The full list stays in `docs/to-test.md`; this is the short, current one.

## 0. Look and layout (watch for these on every screen)

| Test | iPhone | Android |
| --- | :---: | :---: |
| Nothing sits under the status bar (clock, battery) or under the bottom bar / home indicator | [ ] | [ ] |
| No text cut off, overlapping, or breaking mid-word (names, prices, buttons) | [ ] | [ ] |
| Buttons fully visible and easy to tap, none hidden behind the bottom nav | [ ] | [ ] |
| Keyboard never covers the field you're typing in (search, Add a Recipe, post caption) | [ ] | [ ] |
| Bottom sheets open and close smoothly; dragging down / tapping outside closes them | [ ] | [ ] |
| Images load (meal photos, avatars, GIFs); no blank boxes | [ ] | [ ] |
| Fonts look right (Inter, bold titles), no fallback system font | [ ] | [ ] |
| Status bar clock readable on every screen (light on green headers, dark on white) | [ ] | [ ] |
| Scrolling and tab switching feel smooth (judge Android speed on the preview build) | [ ] | [ ] |
| App icon and splash screen look sharp (new build needed for the splash) | [ ] | [ ] |
| Android Back button: closes sheets first, then goes back a screen | n/a | [ ] |

## 1. First run and sign-in

| Test | iPhone | Android |
| --- | :---: | :---: |
| Fresh install: Intro → Get Started → onboarding slides → "Continue without an account" → Home | [ ] | [ ] |
| Close and reopen the app: goes straight to Home (no onboarding) | [ ] | [ ] |
| From Home, swipe back (iPhone) / press Back (Android): never returns to onboarding | [ ] | [ ] |
| Intro title: "AnoUlam" on one line, Get Started above the bottom bar | [ ] | [ ] |
| Sign in with Google | [ ] | [ ] |
| Sign in with Apple | [ ] | n/a |
| Sign out, sign back in | [ ] | [ ] |

## 2. Home, Browse, Price Watch

| Test | iPhone | Android |
| --- | :---: | :---: |
| Home loads meals; carousels scroll smoothly | [ ] | [ ] |
| Settings → Replay page intros, then open Browse and Price Watch: the dot lands cleanly on the title | [ ] | [ ] |
| Browse: search and craving chips work | [ ] | [ ] |
| Price Watch: prices load, fresh picks swipe, categories switch | [ ] | [ ] |

## 3. Meal page

| Test | iPhone | Android |
| --- | :---: | :---: |
| Opens full screen (photo runs up under the status bar, no gap at the top) | [ ] | [ ] known issue |
| Servings + / −: price and calories roll | [ ] | [ ] |
| Tap an ingredient: its sheet opens | [ ] | [ ] |
| Save Meal: confetti, then it shows in Profile → Saved | [ ] | [ ] |
| Start cooking: one step per page, swipe, screen doesn't dim | [ ] | [ ] |
| Share icon on the photo: image card with "₱… per serving" opens the share sheet | [ ] | [ ] |

## 4. Pantry and Meal Planner

| Test | iPhone | Android |
| --- | :---: | :---: |
| Add Ingredients: search, quick add chips, staples checklist | [ ] | [ ] |
| Pantry results: saving a meal from the list bursts confetti | [ ] | [ ] |
| Meal Planner setup: the GIF shows above the budget | [ ] | [ ] |
| Build a plan, swap a meal, open the grocery list | [ ] | [ ] |

## 5. Add a Recipe

| Test | iPhone | Android |
| --- | :---: | :---: |
| Start a recipe, close the app, reopen Add a Recipe: "Continue your …?" restores it | [ ] | [ ] |
| Next without a cover photo: the photo tile turns red and shakes | [ ] | [ ] |
| Ingredients: requirements bar fills; cost summary (Total · Per serving · Calories) rolls | [ ] | [ ] |
| Submit with a photo: shows "Your recipe is in review", appears under Profile → Created | [ ] | [ ] |

## 6. Community

| Test | iPhone | Android |
| --- | :---: | :---: |
| Post a photo: "Preparing your photo…" then "Posting…", posts quickly | [ ] | [ ] |
| GIF and sticker pickers load results | [ ] | [ ] |
| Report someone else's post (second account) | [ ] | [ ] |

## 7. Profile and Settings

| Test | iPhone | Android |
| --- | :---: | :---: |
| Profile tabs: the green pill slides once, smoothly; no jump on a short tab | [ ] | [ ] |
| Change your avatar | [ ] | [ ] |
| Settings → nutrition goal: enter body stats, Calculate; reopen: still filled in | [ ] | [ ] |
| Settings → About → How AnoUlam works: Skip / Done at the bottom, nothing under the status bar | [ ] | [ ] |
| Pro page: Terms of Use and Privacy Policy links open | [ ] | [ ] |
| Phone text size one or two steps larger: text bigger, nothing breaks (Home, meal page, Settings) | [ ] | [ ] |

## 8. Pro, notifications, admin

| Test | iPhone | Android |
| --- | :---: | :---: |
| Subscribe to Pro (sandbox, free in TestFlight) | [ ] | n/a (needs Play setup) |
| Restore purchases | [ ] | n/a |
| Allow notifications, then get one (approve your own test recipe as admin) | [ ] | n/a (needs Firebase) |
| Admin: Review Recipes approve/reject, Manage Meals edit, DA Daily Prices import | [ ] | [ ] |

## Notes

| Phone | Model / build | Anything odd |
| --- | --- | --- |
| iPhone | | |
| Android | Samsung A07 | |
