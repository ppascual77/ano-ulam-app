// What the Pro page shows that isn't layout: the plans, the press feature
// and real quotes (its feature list is unlockedFeatures.ts).

// Daily limits for guests, then signed-in free accounts; Pro has none.
// Counted per account by the database (a Philippine day), or on the phone
// for guests (dailyLimits). Browse searches, and each of Suggest by Budget
// and Suggest by Pantry. The free limits are repeated in the daily_limit
// database function: change both together.
export const GUEST_DAILY_SEARCHES = 3;
export const FREE_DAILY_SEARCHES = 10;
export const GUEST_DAILY_SUGGESTIONS = 3;
export const FREE_DAILY_SUGGESTIONS = 5;

/** A free user's daily limit for this tier, null for Pro. */
export const dailyLimitFor = (tier: { isPro: boolean; isGuest: boolean }, guest: number, free: number) =>
  tier.isPro ? null : tier.isGuest ? guest : free;

// The App Store prices for the Philippines (set 2026-11-08 in App Store
// Connect). Keep in step with it until the page reads real store prices.
export const PLANS = {
  monthly: { label: "Monthly", price: 99, per: "month" },
  yearly: { label: "Yearly", price: 599, per: "year" },
} as const;
export type PlanKey = keyof typeof PLANS;
export const TRIAL_DAYS = 3;
// Earned Pro time, each claimed once: the first approved recipe earns
// RECIPE_REWARD_DAYS, the first Food Post with a photo POST_REWARD_DAYS.
// Granted by the database (pro_rewards migration): change both together.
export const RECIPE_REWARD_DAYS = 7;
export const POST_REWARD_DAYS = 7;

export const YEARLY_SAVE_PCT = Math.round((1 - PLANS.yearly.price / (PLANS.monthly.price * 12)) * 100);

// Press features on the web app (tracking parameters stripped). Logo sizes
// at a 20px height: Radar's has its own navy box (cropped to a rounded
// rectangle), Interaksyon's is transparent.
export const PRESS = [
  {
    outlet: "Radar",
    logo: require("@/assets/pro/radar-logo.png") as number,
    logoWidth: 58,
    boxedLogo: true,
    headline: "New Filipino web app helps answer the daily “Ano ulam?” dilemma",
    url: "https://radar.ph/new-filipino-web-app-helps-answer-the-daily-ano-ulam-dilemma/",
  },
  {
    outlet: "Interaksyon",
    logo: require("@/assets/pro/interaksyon-logo.png") as number,
    logoWidth: 74,
    boxedLogo: false,
    headline: "No more decision fatigue: Pinoy creates app that suggests what to cook",
    url: "https://interaksyon.philstar.com/trends-spotlights/2026/07/20/316109/pinoy-creates-app-suggests-what-to-cook/",
  },
];

// Real Reddit comments on the web app (screenshots in
// ano-ulam-reference/frontend/src/shared/assets/reviews), word for word
// (a stray typo dropped: "know1"; midnightclock's starts at its second
// sentence). About AnoUlam itself, not Pro.
export const QUOTES = [
  { text: "as an ate na laging in charge sa uulamin araw-araw, makaka-help 'to sa akin, thanks po!", author: "lucc_i2" },
  { text: "As someone na nasa work na 9-5, I always wonder kung ano lulutuin ko for me and my partner haha.", author: "midnightclock" },
  { text: "Bookmarked! Bawas isipin din sakin to as taga luto \u{1F923}", author: "hot_mum0827" },
  { text: "super nice neto ngl ang galing mo more people need to know", author: "SeaMonster3141" },
  { text: "Thank you, gamit na gamit ko ito haha", author: "Wild-Faithlessness68" },
];
