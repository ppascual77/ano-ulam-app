import type { MealType } from "@/frontend/core/meals/mealTypes";
import type { MacroTargets } from "@/frontend/core/nutrition/macros";

export type MealSlot = "breakfast" | "lunch" | "dinner";

/** A catalog meal scaled to one serving, with the slots it can fill (its
 *  meal-time tags). `ownCarb`: it already has rice, noodles, bread or oats in
 *  it (silog, pancit, toast), so no cup of rice is counted with it. */
export type PlannerMeal = MealType & { slots: MealSlot[]; ownCarb?: boolean };

// ---- Rice ---------------------------------------------------------------------
// Filipino ulam is eaten with rice, and no recipe counts it, so plans fell far
// short of a calorie goal (BUG-9). "Include rice" counts cups of cooked rice
// per person with every meal that goes with rice (any slot; not a dish that
// already has rice, noodles, bread or oats), in the day's nutrition, its cost
// and the grocery list.

/** Cups of cooked rice per person with each meal that goes with rice (0 = off). */
export type RiceCups = 0 | 1 | 2;
export const RICE_CUP_OPTIONS: RiceCups[] = [0, 1, 2];
/** A new plan's default. */
export const DEFAULT_RICE_CUPS: RiceCups = 1;
/** Raw rice in one cup of cooked rice. */
export const RICE_RAW_GRAMS_PER_CUP = 55;

/** One cup of cooked rice for one person. */
export type RiceCup = { calories: number; protein: number; carbs: number; fats: number; price: number };
/** The catalog rice it's priced from, for the grocery list's Rice line. */
export type RiceIngredient = { id: string; name: string; displayName: string | null; category: string | null };
/** A plan's rice: how many cups, one cup's numbers, and the catalog rice
 *  (absent while it loads: the grocery list then has no Rice line yet). */
export type PlanRice = { cups: RiceCups; cup: RiceCup; ingredient?: RiceIngredient };

type RiceRow = {
  calories: number | string | null;
  protein: number | string | null;
  carbohydrates: number | string | null;
  fat: number | string | null;
  basis_amount: number | string | null;
  basis_unit: string | null;
  estimated_price: number | string | null;
  estimated_price_unit: string | null;
};

/** One cup from the catalog's raw rice (macros per gram basis, price per kg),
 *  so it follows the daily DA price. null when the row can't say. */
export function riceCupFrom(row: RiceRow | null | undefined): RiceCup | null {
  if (!row || row.basis_unit !== "g" || row.estimated_price_unit !== "kg") return null;
  const basis = Number(row.basis_amount);
  const values = [row.calories, row.protein, row.carbohydrates, row.fat, row.estimated_price].map(Number);
  if (!(basis > 0) || values.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const [calories, protein, carbs, fats, pricePerKg] = values;
  const per = RICE_RAW_GRAMS_PER_CUP / basis;
  return {
    calories: calories * per,
    protein: protein * per,
    carbs: carbs * per,
    fats: fats * per,
    price: (pricePerKg * RICE_RAW_GRAMS_PER_CUP) / 1000,
  };
}

/** Used until the catalog's rice loads (or if it can't): USDA white rice,
 *  ₱54/kg. */
export const FALLBACK_RICE_CUP: RiceCup = riceCupFrom({
  calories: 358.7,
  protein: 7.04,
  carbohydrates: 80.31,
  fat: 1.03,
  basis_amount: 100,
  basis_unit: "g",
  estimated_price: 54,
  estimated_price_unit: "kg",
})!;

// An ingredient that is the dish's own carb: rice, noodles, bread (toast,
// sandwiches) or oats. Not rice paper (lumpia is eaten with rice), rice flour,
// rice vinegar, wrappers or breadcrumbs (a breaded dish still goes with rice).
const OWN_CARB =
  /\b(white|brown|glutinous|fried) rice\b|^rice, (white|brown)\b|sinangag|noodles?\b|spaghetti|macaroni|pasta\b|\bbread\b|pandesal|\boats?\b/i;
const NOT_OWN_CARB = /flour|paper|vinegar|wrapper|crumb/i;
export const isOwnCarbIngredient = (name: string) => OWN_CARB.test(name) && !NOT_OWN_CARB.test(name);

/** Cups of rice counted with this meal (per person): any slot, breakfast
 *  too (daing, torta), unless the dish has its own carb. `slot` is kept for
 *  callers that pass it. */
export function riceCupsFor(_slot: MealSlot, meal: PlannerMeal, rice: PlanRice | null | undefined): number {
  if (!rice || rice.cups === 0 || meal.ownCarb) return 0;
  return rice.cups;
}

/** A plan's length when nothing else says (free accounts; Pro can pick 7
 *  in Settings). A plan's own length is plan.days.length. */
export const PLAN_DAYS = 5;
export const PLAN_LENGTHS = [5, 7] as const;
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
export const SLOT_LABELS: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

// Which of today's meals is up next, by the time of day: breakfast until
// 10, lunch until 3, then dinner ("Tonight"). Home's plan card and
// Profile's plan banner.
export function upNextSlot(now = new Date()): MealSlot {
  const h = now.getHours();
  return h < 10 ? "breakfast" : h < 15 ? "lunch" : "dinner";
}

export type PlannedMeal = { slot: MealSlot; meal: PlannerMeal };
export type PlanDay = { date: Date; meals: PlannedMeal[] };
export type MealPlan = {
  days: PlanDay[];
  budget: number;
  servings: number;
  targets: MacroTargets | null;
  /** null/absent: no rice counted (also plans built before "Include rice"). */
  rice?: PlanRice | null;
};

// Per-person price of one serving (catalog prices cover serving_size).
export const perServing = (meal: PlannerMeal) => Number(meal.price) / (meal.serving_size ?? 1);

/** One meal's cost for everyone, with its rice. */
export const mealCost = (slot: MealSlot, meal: PlannerMeal, servings: number, rice?: PlanRice | null) =>
  (perServing(meal) + riceCupsFor(slot, meal, rice) * (rice?.cup.price ?? 0)) * servings;

// The day's totals for one person (macros) and for everyone (cost), with
// the plan's rice.
export function dayTotals(day: PlanDay, servings: number, rice?: PlanRice | null) {
  return day.meals.reduce(
    (sum, { slot, meal }) => {
      const cups = riceCupsFor(slot, meal, rice);
      const cup = rice?.cup;
      return {
        calories: sum.calories + meal.calories + (cup ? cups * cup.calories : 0),
        protein: sum.protein + meal.protein + (cup ? cups * cup.protein : 0),
        carbs: sum.carbs + meal.carbs + (cup ? cups * cup.carbs : 0),
        fats: sum.fats + meal.fats + (cup ? cups * cup.fats : 0),
        cost: sum.cost + mealCost(slot, meal, servings, rice),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, cost: 0 },
  );
}

// Small seeded RNG (mulberry32), so the same inputs on the same day give the
// same plan: easier to test than a fresh shuffle every time.
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Today plus the next length - 1 calendar days.
export function planDates(from = new Date(), length: number = PLAN_DAYS): Date[] {
  const start = startOfDay(from);
  return Array.from({ length }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

const COMBO_TRIES = 60;

type GenerateInput = {
  pool: PlannerMeal[];
  budget: number;
  servings: number;
  targets: MacroTargets | null;
  from?: Date;
  /** Extra seed: "Regenerate" passes a new one for a different plan from
   *  the same inputs (otherwise the same inputs on the same day give the
   *  same plan). */
  seed?: number;
  /** Days in the plan (PLAN_LENGTHS). */
  length?: number;
  rice?: PlanRice | null;
};

type PickDayInput = {
  bySlot: Record<MealSlot, PlannerMeal[]>;
  date: Date;
  servings: number;
  dayBudget: number;
  targets: MacroTargets | null;
  /** How often each meal is already in the plan (repeats score worse). */
  used: Map<string, number>;
  random: () => number;
  rice: PlanRice | null;
};

// The best of COMBO_TRIES random breakfast/lunch/dinner combinations for one
// day: within budget, then closest to the targets, then least repetitive.
function pickDay({ bySlot, date, servings, dayBudget, targets, used, random, rice }: PickDayInput): PlannedMeal[] | null {
  let best: { meals: PlannedMeal[]; score: number } | null = null;
  for (let i = 0; i < COMBO_TRIES; i++) {
    const meals = SLOTS.map((slot) => ({ slot, meal: bySlot[slot][Math.floor(random() * bySlot[slot].length)] }));
    // No dish twice in one day (a meal tagged for breakfast and lunch, e.g.
    // silog, could otherwise fill both).
    if (new Set(meals.map(({ meal }) => meal.id)).size < meals.length) continue;
    const totals = dayTotals({ date, meals }, servings, rice);
    if (totals.cost > dayBudget) continue;
    let score = meals.reduce((sum, { meal }) => sum + (used.get(meal.id as string) ?? 0) * 1.5, 0);
    if (targets) {
      score += Math.abs(totals.calories - targets.calories) / targets.calories;
      score += Math.max(0, targets.protein - totals.protein) / targets.protein;
    }
    if (!best || score < best.score) best = { meals, score };
  }
  return best?.meals ?? null;
}

const groupBySlot = (pool: PlannerMeal[]) =>
  Object.fromEntries(SLOTS.map((slot) => [slot, pool.filter((m) => m.slots.includes(slot))])) as Record<MealSlot, PlannerMeal[]>;

// "Regenerate day": a fresh set of meals for one day of an existing plan,
// avoiding the day's current meals and the rest of the week's where it can.
// null when nothing fits.
export function regenerateDay(pool: PlannerMeal[], plan: MealPlan, dayIndex: number): PlannedMeal[] | null {
  const used = new Map<string, number>();
  plan.days.forEach((day, i) =>
    day.meals.forEach(({ meal }) => used.set(meal.id as string, (used.get(meal.id as string) ?? 0) + (i === dayIndex ? 3 : 1))),
  );
  return pickDay({
    bySlot: groupBySlot(pool),
    date: plan.days[dayIndex].date,
    servings: plan.servings,
    dayBudget: plan.budget / plan.days.length,
    targets: plan.targets,
    used,
    random: Math.random,
    rice: plan.rice ?? null,
  });
}

// Builds a plan of `length` days (5, or 7 for Pro; breakfast, lunch, dinner)
// within budget: each day may spend an equal share of it. Tries random combinations
// per day and keeps the best one: under budget first, then (with a macro
// goal) closest to the calorie and protein targets, and least repetitive.
// Returns null when no day can be filled within budget.
export function generatePlan({ pool, budget, servings, targets, from = new Date(), seed = 0, length = PLAN_DAYS, rice = null }: GenerateInput): MealPlan | null {
  const dates = planDates(from, length);
  const bySlot = groupBySlot(pool);
  if (SLOTS.some((slot) => bySlot[slot].length === 0)) return null;

  const dayBudget = budget / dates.length;
  const random = seededRandom(Math.round(budget) * 31 + servings * 7 + startOfDay(from).getTime() / 86400000 + seed);
  const used = new Map<string, number>();
  const days: PlanDay[] = [];

  for (const date of dates) {
    const meals = pickDay({ bySlot, date, servings, dayBudget, targets, used, random, rice });
    if (!meals) return null;
    for (const { meal } of meals) used.set(meal.id as string, (used.get(meal.id as string) ?? 0) + 1);
    days.push({ date, meals });
  }

  return { days, budget, servings, targets, rice };
}

// Other meals for a slot (the Swap sheet), cheapest first, excluding the
// day's current pick. Kept to ones that keep the day within budget.
export function swapOptions(pool: PlannerMeal[], plan: MealPlan, dayIndex: number, slot: MealSlot): PlannerMeal[] {
  const day = plan.days[dayIndex];
  const current = day.meals.find((m) => m.slot === slot)?.meal;
  const othersCost = day.meals
    .filter((m) => m.slot !== slot)
    .reduce((sum, m) => sum + mealCost(m.slot, m.meal, plan.servings, plan.rice), 0);
  const dayBudget = plan.budget / plan.days.length;
  // Not the current pick, nor a dish already in another of the day's slots.
  const inDay = new Set(day.meals.map(({ meal }) => meal.id));
  return pool
    .filter((meal) => meal.slots.includes(slot) && !inDay.has(meal.id))
    .filter((meal) => othersCost + mealCost(slot, meal, plan.servings, plan.rice) <= dayBudget)
    .sort((a, b) => perServing(a) - perServing(b));
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// "Today" for the first day, else the short weekday ("Sun").
export const dayLabel = (date: Date, index: number) => (index === 0 ? "Today" : WEEKDAY.format(date));
export const monthDay = (date: Date) => MONTH_DAY.format(date);
export const formatPeso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;
