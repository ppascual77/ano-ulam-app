import type { MacroTargets } from "./macros";
import type { MealSlot, PlannerMeal } from "../mock/plannerMeals";

export const PLAN_DAYS = 5;
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
export const SLOT_LABELS: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export type PlannedMeal = { slot: MealSlot; meal: PlannerMeal };
export type PlanDay = { date: Date; meals: PlannedMeal[] };
export type MealPlan = { days: PlanDay[]; budget: number; servings: number; targets: MacroTargets | null };

// Per-person price of one serving (catalog prices cover serving_size).
export const perServing = (meal: PlannerMeal) => Number(meal.price) / (meal.serving_size ?? 1);

// The day's totals for one person (macros) and for everyone (cost).
export function dayTotals(day: PlanDay, servings: number) {
  return day.meals.reduce(
    (sum, { meal }) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fats: sum.fats + meal.fats,
      cost: sum.cost + perServing(meal) * servings,
    }),
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

// Today plus the next PLAN_DAYS - 1 calendar days.
export function planDates(from = new Date()): Date[] {
  const start = startOfDay(from);
  return Array.from({ length: PLAN_DAYS }, (_, i) => {
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
};

// Builds a 5-day plan (breakfast, lunch, dinner) within budget: each day
// may spend about a fifth of the weekly budget. Tries random combinations
// per day and keeps the best one: under budget first, then (with a macro
// goal) closest to the calorie and protein targets, and least repetitive.
// Returns null when no day can be filled within budget.
export function generatePlan({ pool, budget, servings, targets, from = new Date() }: GenerateInput): MealPlan | null {
  const dates = planDates(from);
  const bySlot = Object.fromEntries(SLOTS.map((slot) => [slot, pool.filter((m) => m.slots.includes(slot))])) as Record<
    MealSlot,
    PlannerMeal[]
  >;
  if (SLOTS.some((slot) => bySlot[slot].length === 0)) return null;

  const dayBudget = budget / PLAN_DAYS;
  const random = seededRandom(Math.round(budget) * 31 + servings * 7 + startOfDay(from).getTime() / 86400000);
  const used = new Map<string, number>();
  const days: PlanDay[] = [];

  for (const date of dates) {
    let best: { meals: PlannedMeal[]; score: number } | null = null;
    for (let i = 0; i < COMBO_TRIES; i++) {
      const meals = SLOTS.map((slot) => ({ slot, meal: bySlot[slot][Math.floor(random() * bySlot[slot].length)] }));
      // No lunch and dinner the same day.
      if (meals[1].meal.id === meals[2].meal.id) continue;
      const totals = dayTotals({ date, meals }, servings);
      if (totals.cost > dayBudget) continue;
      let score = meals.reduce((sum, { meal }) => sum + (used.get(meal.id as string) ?? 0) * 1.5, 0);
      if (targets) {
        score += Math.abs(totals.calories - targets.calories) / targets.calories;
        score += Math.max(0, targets.protein - totals.protein) / targets.protein;
      }
      if (!best || score < best.score) best = { meals, score };
    }
    if (!best) return null;
    for (const { meal } of best.meals) used.set(meal.id as string, (used.get(meal.id as string) ?? 0) + 1);
    days.push({ date, meals: best.meals });
  }

  return { days, budget, servings, targets };
}

// Other meals for a slot (the Swap sheet), cheapest first, excluding the
// day's current pick. Kept to ones that keep the day within budget.
export function swapOptions(pool: PlannerMeal[], plan: MealPlan, dayIndex: number, slot: MealSlot): PlannerMeal[] {
  const day = plan.days[dayIndex];
  const current = day.meals.find((m) => m.slot === slot)?.meal;
  const othersCost = day.meals
    .filter((m) => m.slot !== slot)
    .reduce((sum, { meal }) => sum + perServing(meal) * plan.servings, 0);
  const dayBudget = plan.budget / PLAN_DAYS;
  return pool
    .filter((meal) => meal.slots.includes(slot) && meal.id !== current?.id)
    .filter((meal) => othersCost + perServing(meal) * plan.servings <= dayBudget)
    .sort((a, b) => perServing(a) - perServing(b));
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// "Today" for the first day, else the short weekday ("Sun").
export const dayLabel = (date: Date, index: number) => (index === 0 ? "Today" : WEEKDAY.format(date));
export const monthDay = (date: Date) => MONTH_DAY.format(date);
export const formatPeso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;
