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

## Push notifications (recipe approved)

Needs a new dev build (`expo-notifications` is native) with push set up: answer yes to "Setup Push
Notifications" when `eas build --profile development --platform ios` asks.

- [ ] **Quiet by default:** fresh install (or delete and reinstall), sign in: no prompt, and a
      `push_tokens` row appears. Settings → Notifications shows Push notifications on, "Arriving
      quietly in Notification Center", and "Show as banners with sound" (iOS's prompt). An approval
      push lands in Notification Center without a banner, with iOS's Keep / Turn off choice.
- [ ] **The ask:** submit a recipe as a non-admin account. The review screen shows "Notify me when
      it's live" (also while quiet); tapping it shows iOS's prompt. Allow: the button turns into "We'll notify you when
      it's live" and a row appears in `push_tokens` for that account.
- [ ] **The push, with the reward:** approve that account's first recipe as admin (app in the
      background). "Your recipe is live! 🎉 … You've earned 7 days of Pro!" arrives; tapping it opens
      the app and the reward celebration plays.
- [ ] **Later approvals:** a second approved recipe says "… is now on AnoUlam for everyone to cook."
- [ ] **App open:** approving while the app is open still shows the banner.
- [ ] **Settings → Notifications → Push notifications:** off, approve another: no push. On again: pushes resume. With
      notifications refused in iOS Settings, the toggle shows off and turning it on opens iOS Settings.
- [ ] **Log out:** the phone's `push_tokens` row is gone; another account signing in on the same
      phone gets its own pushes, not the old account's.
- [ ] **Refused:** tapping "Don't Allow" hides the button and never asks again.

## Push notifications (Price Watch)

Sent by the database on a schedule (11:30 and 16:30 PH daily, Saturday 08:00 PH). To trigger one by
hand, ask Claude to run `send_daily_price_alert()` / `send_weekly_best_buys()` (each sends once per
DA day / week; `price_alert_log` records it).

- [ ] **Daily drop alert (Pro):** with Pro on, "🔻 <item> is N% cheaper · Now ₱X/kg, down from ₱Y a
      week ago" arrives; tapping it opens Price Watch, including from a closed app. Free accounts
      get no daily alert.
- [ ] **Not every day:** a day with no drop of 5% or more sends nothing; the same item isn't alerted
      twice within 3 days; the 16:30 run doesn't repeat the 11:30 one.
- [ ] **Weekly best buys (Saturday):** Pro gets "Pork Rind/Skin ₱58/kg less · …" (3 items, pesos);
      Free gets the top item plus "Get alerts the day prices drop with Pro". Tapping opens Price Watch.
- [ ] **Names read well:** meat items say the animal ("Chicken Neck", "Pork Rind/Skin").
- [ ] **Settings → Notifications:** Price drop alerts (PRO badge; locked for Free, opens the Pro
      page titled "Get price drop alerts") and Weekly best buys show under Push notifications while
      it's on; each switch stops its push; Push notifications off stops both.
- [ ] **The Pro section** no longer has the old "Price alerts" row.

## Security lockdown

The RLS lockdown (`20261109000000`) is live since 2026-11-13 (SQL checks passed). On a phone:

- [ ] **Add a Recipe as a regular account:** submit one with a cover photo and 3+ ingredients; it
      shows under Created as in review with its photo; edit it while pending; delete it (photo gone).
- [ ] **Admin screens as the admin account:** Review Recipes approve/reject, Manage Meals edit and
      archive, Manage Ingredients edit, Seed Meal save with a photo, DA Daily Prices manual import.
      Any "permission denied" / "row-level security" error means a missing policy.

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
- [ ] **Delete account** (deployed 2026-11-12): with a throwaway account, Settings → Delete account
      removes the user, their recipes and photos, their posts, and signs out to a guest. Try it on an
      account that has a recipe, a food post with a photo and saved meals.

## Meal Planner and Pro locks

- [ ] **Free:** days 2+ locked (orange lock), day actions locked, "Shop the whole week" locked,
      macro goal card locked: each opens the Pro page with its own title.
- [ ] **Macro goal card** (Free): premium accent card, bars fill in, light sweep; Reduce motion
      turns both off.
- [ ] **Grocery buttons:** "Today's grocery list" shows the viewed day ("Grocery list for Wed,
      Nov 12" on another day); the week list shows the whole plan (Pro).
- [ ] **Locked micronutrients** in meal details open the Pro page inside the meal sheet and return
      to the meal when closed.

## Results depth cap (free accounts)

- [ ] **Suggest by Budget:** a group with more than 10 results shows 5, Show More to 10, then the
      "See every match with Pro" card (+N more); See All lists the same 10. Pro sees everything.
- [ ] **Browse:** a category row with more than 10 ends in the Pro card; fewer than 10, no card.
- [ ] **Pantry results:** the first 10 matches (Cook now first), then the Pro row under the list;
      the summary still says how many were found.
- [ ] **The card opens the Pro page** titled "See every match"; searches still count once each.
- [ ] **Blurred peek:** the card shows the next locked meal's photo blurred (carousels: filling the
      card; Pantry and See All: one thumbnail with a lock), readable text on top, nothing about the
      meal legible.

## Home, Profile and Discover polish

- [ ] **Community Favorites** (Home): the 5-tile magazine spread (hero, tall + two small, full-width
      closer), rank numerals, saves pill top right, blocks rise in turn; tapping opens the meal;
      fewer than 5 favorites still lays out.
- [ ] **Profile**: the plan banner shows only while a plan runs today (free: day 1 only) and opens
      the planner on today; the floating + opens Create (glass, no pulse); Created shows
      RECIPES · n and FOOD POSTS · n with post cards; the Profile tab's selected state doesn't touch
      its label.
- [ ] **Profile redesign** (2026-11-13): green textured header behind the clock with a light
      "Profile." and a white Settings circle; its curve crosses the middle of the 92px avatar
      (free and Pro, whose accent ring shows on the green); the clock turns dark and the strip
      white once the white page is under it. Saved · Recipes · Posts count up once and switch tab
      on tap (Posts goes to Created; a new or deleted post updates it). Empty bio shows the dashed
      "Add a bio" chip; editing shows the counter only in the last 10 characters, red when over,
      and a light tap on save. Tab bar: with four tabs only the active one has its label, it widens
      as the pill slides (no bounce); a selection tick on change; content slides 12px from the side
      of the tab picked (fade only with Reduce motion). Scrolled down: the avatar shrinks a little,
      the tabs pin just *below* the status bar with the small avatar + name above them, the + shrinks
      while scrolling down and comes back on scrolling up. Someone else's profile and the official
      one: tabs and mini header match, nothing else broke.
- [ ] **Add Ingredients sheet** (2026-11-13, Home and Profile's Pantry tab): pill search field;
      before typing, Quick add chips (garlic, red onion, egg, white rice, chicken thigh, tomato,
      only the ones not added) and, after removing something, Recently removed. Results show the
      everyday name (no icons), the alias under it when that's what matched ("bawang"
      finds Garlic), no Main/Staple tag; a nonsense search says "No 'x' yet" with the bawang hint.
      Tapping a result or chip: the chip arcs up into the tray's first slot (~0.35s) with a light
      tap, the tray count rolls, the keyboard stays up and the chip is visible above it. With 5+
      items the tray shows the newest 4 and "+N more"; that opens all of them wrapped in a short
      box that scrolls down, with "Show less" (add 20+ to check the search results still fit). Reduce
      motion: no flight, the chip fades in. Footer: "Add N more to see meals" (outline) under 3
      items, then "Show N meals", which closes the sheet and opens the results (counts toward the
      daily limit; the limit sheet shows when out). Removing a chip slides the rest over.
- [ ] **Staples checklist**: grouped under Sauces & oil / Seasonings / Aromatics with Select
      all / none; "Untick what you don't have."; the button reads "Add N staples" and
      changes as you untick (Done when nothing new); ticking eases the box in and draws the check.
- [ ] **Home pantry chips**: no Edit/Done toggle, every chip always has its x and it's easy to
      hit; removing slides the others into place; "+N more" / "Show less" still fold a long tab. Empty pantry: only the
      one "Add ingredients" button (no arrow, no header button); the header button shows once
      something is added, same label.
- [ ] **Discover tabs**: glass capsule over the reel, white glass on Community, thumb slides, the +
      lines up with it and opens Create in one tap; Community posts scroll under the tabs.

## Add a Recipe flow (2026-11-13)

- [ ] **Draft survives:** type a name and two ingredients, then (a) swipe back, (b) background the
      app and kill it within a second of typing. Reopening Add a Recipe asks "Continue your
      <name>?" with "You last worked on it …"; Continue restores everything (same step, photo,
      quantities, steps); Start over gives a blank form; tapping outside the sheet continues. Prices
      on restored lines are today's. A second account on the same phone doesn't see the draft.
- [ ] **✕ with something typed** asks "Save as a draft?": Save draft closes and the draft is there
      next time; Discard closes and it's gone; tapping outside stays on the form. ✕ on an untouched
      form just closes. No stuck overlay after either.
- [ ] **Blocked states:** signed out shows the sign-in prompt (art, Apple/Google buttons) and signing
      in lands on the form; at 5 recipes the limit sheet opens over a blank screen, "See my recipes"
      opens Profile on Created, dismissing it closes the screen.
- [ ] **Four steps:** Details, Ingredients, Steps, Review. Step 1 shows one full-width Next. The bar
      fills as you advance, finished steps show a check and are tappable (also forward when earlier
      steps are complete), the header shows the recipe name once typed. Each step slides 16px in
      from the side you're heading (fade only with Reduce motion), no slide on first open.
- [ ] **Every step opens the same way:** a dotted title and one line ("The basics", "What goes
      in it", "How to cook it", "Ready to share"), the same spacing between blocks on all four.
- [ ] **Details:** cover tile is the meal card's shape (5:3) and the crop matches it; Take photo asks
      for the camera (the custom permission text needs the next dev build), Library opens photos;
      Retake / Change photo once set. Prep time is one row: 15 30 45 60 90 and Custom; Custom turns
      into the minutes box itself (focused, number pad), a preset turns it back; reopening a draft
      with e.g. 25 min shows it in Custom; empty prep on Next turns the row red and shakes it.
      Difficulty (switch) and Servings (stepper, 1 to 10, starts at 4) sit side by side with labels
      above, fitting the smallest iPhone. The name counter appears only from 40 characters, red at
      50. Missing name/description still shake.
- [ ] **Ingredients:** Quick add chips (garlic, onion, soy sauce, vinegar, oil, salt, pepper,
      ginger, tomato, minus what's added) under the empty search. A new line slides in at the
      bottom with a light tap, its Qty box focused and scrolled above the keyboard. The
      Requirements box: a three-part bar filling as each rule is met, "n of 3", and one line naming
      the next thing to do (amber after a failed Next), then "Ready. Price and nutrition are
      counted." The summary above the keyboard: Total cost · Per serving (n) · Calories in three
      equal columns with dividers, labels above, numbers rolling without shifting the columns.
- [ ] **Steps:** soft cards, number in a green circle, 16px text. Return moves to the next step
      (adds one from the last non-empty step, up to 12). Long-press a card to lift it (light tick),
      or drag the grip; long-press inside a step being edited still moves the cursor, not the card.
      Mention "garlic" or "bawang" with garlic in the list: a Garlic tag appears under the step.
- [ ] **Review:** card rises in with a small scale-up (no bounce); View Details opens the full
      preview sheet, ingredients in it open their sheet on top. Submit shows a spinner; on success
      it shrinks into an orange dot and the Submitted screen's medallion pops. Turn off Wi-Fi first:
      an error toast at the top, the button reads "Try again", the draft is still saved.

## Meal details: cook mode and share (2026-11-13, needs a new dev build)

New native packages: `react-native-view-shot`, `expo-sharing`, `expo-keep-awake`. Run
`eas build --profile development --platform ios` before testing share and cook mode.

- [ ] **Rolling numbers:** changing servings rolls the price under the name and the Calories card.
- [ ] **Cook mode:** "Start cooking" beside Steps. Slides up over the meal page (fade with Reduce
      motion), dark status bar, "n / N" and a segment bar, one step per page in large text; swipe or
      Next/Back, a light tick per change; Done on the last closes back to the meal where it was.
      Leave it open 2+ minutes: the screen doesn't dim or lock. Not shown in the Add a Recipe preview.
- [ ] **Share:** share icon on the photo (not on admin screens, unpublished own recipes or the
      recipe preview); spinner while it builds the image, then the share sheet with a 4:5 card: photo,
      name with the orange dot, "₱47 per serving", kcal per serving, prep time, serves N, AnoUlam mark.
      Share to Messages/IG; cancel the share sheet: nothing else happens. Airplane mode with an
      uncached photo: the card still shares after ~2.5s.

## Photo uploads and the RLS audit (2026-11-13)

- [ ] **Photos upload as images:** post a Community photo, change your avatar, and submit a recipe
      with a cover photo. Each shows up as before. Then tell Claude to check Storage: the new files
      should be `image/jpeg` (or png/heic), not `text/plain`; after that the buckets get an
      image-only rule.
- [ ] **Deleting still cleans up:** delete your own pending recipe (its photo folder goes) and a post
      with a photo.
- [ ] **Moderated posts:** a removed post stays visible (labelled) on its author's own profile,
      hidden for everyone else; admin Reported Posts still lists it.

## Body stats on the account (2026-11-13)

- [ ] **Old phone copy moves in:** on a phone that had set a nutrition goal before, open Settings
      (or the planner) and the goal setup: the stats are still filled in. Delete and reinstall the
      app, sign in: the setup still prefills (it's on the account now).
- [ ] **Saving:** change weight in the setup and tap Calculate; reopen: the new weight is there.
      On a second phone with the same account: same stats.
- [ ] **Privacy page** (Settings → Privacy) lists Body stats (optional) and dated November 2026.

## Pro feature reels (Settings, free account)

- [ ] **Each locked Pro feature opens its reel sheet:** Price drop alerts (a phone lock screen,
      today's real drops arriving as notifications with a soft tap), Meal plan length (the week
      filling with real meal photos, "5-day plan" then "7-day plan"), Ingredients to avoid (the
      chip tapped, meals with it shrinking away, "N meals … hidden"), Nutrition goals (protein and
      calorie bars filling to the goal line, "Fits your goals" popping on). Each loops smoothly.
- [ ] **The button** says "Try Pro free for 3 days" (or "Get Pro" after any Pro) and opens the Pro
      page titled for that feature; "Not now" closes. The content stays while the sheet slides away.
- [ ] **Reduce motion:** each reel shows its finished frame, no loop, no haptic.
- [ ] **Settings is otherwise unchanged:** Meal preferences rows (Dietary focus / Food allergies with
      what's set) open the preferences sheet; the account card shows PRO / Free / Guest only; the
      Earned Pro card has the days-left bar and the 2×2 "what's included" checklist.

## Onboarding and preferences

- [ ] **Onboarding:** no goals preselected, no "None" chips, Clear appears once something is
      picked, glass sign-in buttons on the last slide, the 7-days-free note under the benefits.
- [ ] **Preferences** in Settings and Home's sheet: no "None" chip, dietary focus can be cleared,
      saved preferences still filter meals.
- [ ] **Login gate sheets** (save, post) show the 7-days-free note; the Pro gate doesn't.
- [ ] **Guest saving from anywhere** (Home cards, Pantry results, meal details from Home, Browse,
      Discover): the login sheet opens, no error toast. Signing in saves that meal straight away;
      swiping the sheet away saves nothing. Inside meal details the sheet opens over the meal.

## Community moderation

- [ ] **Report:** someone else's post → ⋯ → Report post: pick a reason (Send stays disabled until
      one is picked), optional note, Send. Toast "Thanks for reporting", the post leaves your feed
      (and stays gone after refresh). Your own posts have no Report.
- [ ] **3 reports hide it for everyone** (needs 3 accounts): it disappears from other users' feeds
      and shows as HIDDEN in Admin → Reported Posts; Restore brings it back.
- [ ] **Admin Remove** from a post's ⋯ menu (admin account): confirmation, then gone for everyone;
      the poster sees it in their Profile with "Removed by AnoUlam. Only you can see this post."
- [ ] **Reported Posts screen:** reasons summary and notes, Remove / Dismiss, the list and feeds
      update after each.
- [ ] **Poster can't undo a removal** by editing the post (edit still saves the caption).

## Store setup (no device needed)

- [ ] EU countries still off (148 countries) on the app and both subscriptions.
- [ ] Each subscription has its review screenshot, and the first group goes to review with an app
      version.
- [ ] Small Business Program approved (Apple's email).
- [ ] Paywall promises match what's built (price drop alerts and weekly savings are pushes now:
      check the Pro page and unlock screen wording against them).
- [ ] BIR registration before Apple's first payout (`docs/compliance.md`).
