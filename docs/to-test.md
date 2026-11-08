# To test before release

Things built but not fully tested on a device yet, and the checks to run before TestFlight or
the App Store. Tick them off as they pass; add a line under any that fails. Started 2026-11-08.

Test in the dev build (`npx expo start --dev-client`), signed in, with the sandbox tester
(`patrickgbpascual+sandbox2@gmail.com`, renewal rate 3 minutes) unless it says otherwise.
RevenueCat's dashboard hides test data: switch on **Sandbox data** (top right) to see it.

## Pro in the database (webhook)

- [ ] **Purchase reaches the database.** Buy Monthly. Within a few seconds RevenueCat → Integrations
      → Webhooks shows a successful delivery, and `users.pro_until` for your account is about 3
      minutes ahead.
- [ ] **Saved meals past 10 while Pro.** With Pro on, save an 11th and 12th meal: both save.
- [ ] **Daily limits off while Pro.** With Pro on, do more than 10 Browse searches and more than 5
      Suggest by Budget in a day: no limit sheet.
- [ ] **Cancel and expiry reach the database.** Cancel in Apple's screen, let it run out. After
      expiry, `pro_until` is in the past, and saving an 11th meal is refused (Free again).
- [ ] **Restore moves Pro.** Sign in to a second AnoUlam account on the same phone and tap Restore
      purchases: Pro moves to it (RevenueCat "Transfer"), and `pro_until` updates on both accounts.

## Pro rewards

- [ ] **First approved recipe: 7 days.** From a test account, submit a recipe; approve it as admin.
      `pro_rewards` gets one `recipe` row, `users.pro_reward_until` is 7 days out, and the app
      (after reopening Settings) shows **Earned Pro · EARNED**, with Pro features unlocked.
- [ ] **Second approved recipe: nothing.** Approve another from the same account: no new row, the
      date doesn't move.
- [ ] **First photo post: 7 days.** Same account, post a Food Post with a photo: one `photo_post`
      row, `pro_reward_until` moves 7 more days out (stacks on the recipe's days).
- [ ] **Second photo post, and posts without a photo: nothing.**
- [ ] **Earned Pro ends on time.** (Shorten it by hand in the database to a few minutes ahead to
      test.) Pro switches off when it ends; the Earned card goes away.
- [ ] **Earn Pro sheet** shows "Done" for each claimed reward and only the days still to earn.
- [ ] **Reward celebration:** after a first photo post (once the composer closes), and on the next
      app open after a first recipe is approved: dimmed screen, gift medallion pops with rings and a
      haptic, "+7" counts up, "days of Pro", the right line and "Pro is on until …". Shows once per
      reward (not again on reopening). Reduce motion: fades, final number.
- [ ] **First post nudge:** new post, photo reward unclaimed: the accent bar above the toolbar
      ("Add a photo to earn 7 days of Pro", gift wiggles once), Add photo opens the picker, the
      Photo pill is orange; with a photo it turns into "Nice! This post earns you 7 days of Pro"
      (check pops); a GIF/sticker brings the ask back. Not shown when editing, after the reward, or
      to paying subscribers. The bar rides on the keyboard.
- [ ] **Recipe in review screen:** green check medallion, the track filling to "In review" with a
      breathing dot, the "Approval earns you 7 days of Pro" pill only while that reward is open.
- [ ] **Create sheet** (free user): both rows tagged "+7 DAYS PRO" with a line saying what earns
      it; after a first photo post the Food Post tag is gone right away and Pro turns on; after a
      first approved recipe the recipe tag is gone (next time the sheet opens).

## Security lockdown

- [ ] **Profile edits still work:** bio, Settings toggles (show saved, newsletter), preferences,
      onboarding preferences save, Apple sign-in saving the name.
- [ ] **Can't make yourself Pro:** updating `tier`, `pro_until` or `pro_reward_until` as a signed-in
      user is refused (checked once with SQL on 2026-11-08; recheck after any users migration).

## App Store subscriptions

- [ ] **Free trial offered once.** New sandbox tester (or Reset Eligibility): the Pro page says
      "Start 3-day free trial". After any Pro on the account it says "Subscribe for ₱99.00/month".
- [ ] **Purchase animation:** padlock tugs during Apple's sheet, opens on success, fades away on
      cancel. With Reduce motion: no tugging, lock just opens.
- [ ] **Guest buying:** signed out, tapping Start on the Pro page asks to sign in first, then
      carries on to Apple's sheet.
- [ ] **Plan card states:** Free trial → Active → Cancelled ("Pro until …") → Expired (grey, taps to
      the Pro page, gone after 30 days).
- [ ] **Manage in the App Store** opens Apple's screen; a cancel or plan switch there shows on the
      card when it closes.
- [ ] **Yearly** purchase, and switching Monthly → Yearly in Apple's screen (Yearly is level 1, so
      it starts right away).
- [ ] **Restore purchases** on a fresh install finds an active subscription; with none, says so.
- [ ] **Prices** on the Pro page come from the App Store (₱99.00 / ₱599.00), and in another
      country's currency on a tester set to that region.
- [ ] **Release build (preview/production) has the RevenueCat key**: add
      `EXPO_PUBLIC_REVENUECAT_IOS_KEY` as an EAS environment variable first, or the Pro page
      shows no store prices and buying fails.
- [ ] **TestFlight purchase** (real build, sandbox account): the whole flow again outside the dev
      build.

## Sign-in

- [ ] **Sign in with Apple** on a fresh account: name saved, overlay shows, no glimpse of the old
      screen. Second sign-in: name kept.
- [ ] **Google sign-in** in the dev build (redirect back to the app, not localhost).
- [ ] **Log out** shows the full-screen overlay and lands on Home.
- [ ] **Delete account** (once `delete-account` is deployed): removes the user, their recipes and
      photos.

## Meal Planner and Pro locks

- [ ] **Free:** days 2+ locked (orange lock), day actions locked, "Shop the whole week" locked,
      macro goal card locked: each opens the Pro page with its own title.
- [ ] **Macro goal card** (Free): premium accent card, bars fill in, light sweep; Reduce motion
      turns both off.
- [ ] **Grocery buttons:** "Today's grocery list" shows the viewed day ("Grocery list for Wed,
      Nov 12" on another day); the week list shows the whole plan (Pro).
- [ ] **Locked micronutrients** in meal details open the Pro page inside the meal sheet and return
      to the meal when closed.

## Home, Profile and Discover polish

- [ ] **Community Favorites** (Home): the 5-tile magazine spread (hero, tall + two small, full-width
      closer), rank numerals, saves pill top right, blocks rise in turn; tapping opens the meal;
      fewer than 5 favorites still lays out.
- [ ] **Profile**: the plan banner shows only while a plan runs today (free: day 1 only) and opens
      the planner on today; the floating + opens Create (glass, no pulse); Created shows
      RECIPES · n and FOOD POSTS · n with post cards; the Profile tab's selected state doesn't touch
      its label.
- [ ] **Discover tabs**: glass capsule over the reel, white glass on Community, thumb slides, the +
      lines up with it and opens Create in one tap; Community posts scroll under the tabs.

## Onboarding and preferences

- [ ] **Onboarding:** no goals preselected, no "None" chips, Clear appears once something is
      picked, glass sign-in buttons on the last slide, the 7-days-free note under the benefits.
- [ ] **Preferences** in Settings and Home's sheet: no "None" chip, dietary focus can be cleared,
      saved preferences still filter meals.
- [ ] **Login gate sheets** (save, post) show the 7-days-free note; the Pro gate doesn't.
- [ ] **Guest saving from anywhere** (Home cards, Pantry results, meal details from Home, Browse,
      Discover): the login sheet opens, no error toast. Signing in saves that meal straight away;
      swiping the sheet away saves nothing. Inside meal details the sheet opens over the meal.

## Store setup (no device needed)

- [ ] EU countries still off (148 countries) on the app and both subscriptions.
- [ ] Each subscription has its review screenshot, and the first group goes to review with an app
      version.
- [ ] Small Business Program approved (Apple's email).
- [ ] Paywall promises match what's built (price drop alerts and weekly savings have no surface
      yet: build them or remove them from the Pro page, `proContent.ts` and `unlockedFeatures.ts`).
- [ ] BIR registration before Apple's first payout (`docs/compliance.md`).
