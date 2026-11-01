import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";

// What the Pro page shows that isn't layout: the Free vs Pro rows, the
// plans, the press feature and real quotes.

export type CompareCell = boolean | string;

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

// Free first, so the page shows how much stays free before what Pro adds.
export const COMPARE_ROWS: { label: string; free: CompareCell; pro: CompareCell }[] = [
  { label: "Meal ideas, prices, macros, allergens", free: true, pro: true },
  { label: "Saved meals", free: String(SAVED_MEALS_LIMIT), pro: "Unlimited" },
  { label: "Meal searches", free: `${FREE_DAILY_SEARCHES} a day`, pro: "Unlimited" },
  { label: "Suggest by budget", free: `${FREE_DAILY_SUGGESTIONS} a day`, pro: "Unlimited" },
  { label: "Suggest by pantry", free: `${FREE_DAILY_SUGGESTIONS} a day`, pro: "Unlimited" },
  { label: "Meal plan", free: "1 day", pro: "5 days" },
  { label: "Grocery list", free: "1 day", pro: "Whole week" },
  { label: "Swap meals", free: false, pro: true },
  { label: "Price drop alerts", free: false, pro: true },
  { label: "Weekly savings, in pesos", free: false, pro: true },
  { label: "Ingredients to avoid", free: false, pro: true },
  { label: "Nutrition goals", free: false, pro: true },
  { label: "Fiber, sugar and sodium", free: false, pro: true },
];

// PLACEHOLDER prices (no subscriptions yet): change here once decided.
export const PLANS = {
  monthly: { label: "Monthly", price: 99, per: "month" },
  yearly: { label: "Yearly", price: 799, per: "year" },
} as const;
export type PlanKey = keyof typeof PLANS;
export const TRIAL_DAYS = 3;
// Earned Pro time: an approved recipe earns RECIPE_REWARD_DAYS, up to
// RECIPE_REWARD_MAX recipes; the first Food Post with a real photo earns
// POST_REWARD_DAYS, once.
export const RECIPE_REWARD_DAYS = 7;
export const RECIPE_REWARD_MAX = 3;
export const POST_REWARD_DAYS = 2;

export const YEARLY_SAVE_PCT = Math.round((1 - PLANS.yearly.price / (PLANS.monthly.price * 12)) * 100);

// Radar's feature on the web app (tracking parameters stripped).
export const RADAR = {
  headline: "New Filipino web app helps answer the daily “Ano ulam?” dilemma",
  url: "https://radar.ph/new-filipino-web-app-helps-answer-the-daily-ano-ulam-dilemma/",
};

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
