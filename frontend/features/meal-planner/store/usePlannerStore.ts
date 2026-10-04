import { create } from "zustand";
import type { Goal, MacroTargets } from "../utils/macros";
import type { MealPlan } from "../utils/generatePlan";
import type { MealSlot, PlannerMeal } from "../mock/plannerMeals";

export type PlannerStage = "setup" | "generating" | "plan" | "error";

type PlannerStore = {
  stage: PlannerStage;
  budget: string;
  servings: number;
  /** null = macro goal off. */
  targets: MacroTargets | null;
  /** The goal the targets were made for (shown on the enabled card). */
  goal: Goal | null;
  plan: MealPlan | null;
  /** MOCK: no subscriptions yet. "Unlock Premium" flips this (resets on reload). */
  isPremium: boolean;
  setStage: (stage: PlannerStage) => void;
  setBudget: (budget: string) => void;
  setServings: (servings: number) => void;
  setTargets: (targets: MacroTargets | null, goal?: Goal | null) => void;
  setPlan: (plan: MealPlan | null) => void;
  setPremium: (isPremium: boolean) => void;
  swapMeal: (dayIndex: number, slot: MealSlot, meal: PlannerMeal) => void;
};

// Meal Planner state. Event-driven (setup -> generating -> plan), and kept
// across tab switches, so a store rather than screen state. Not persisted:
// this is a test build of the flow, no meal-plan records yet.
export const usePlannerStore = create<PlannerStore>((set) => ({
  stage: "setup",
  budget: "",
  servings: 1,
  targets: null,
  goal: null,
  plan: null,
  isPremium: false,
  setStage: (stage) => set({ stage }),
  setBudget: (budget) => set({ budget }),
  setServings: (servings) => set({ servings }),
  setTargets: (targets, goal = null) => set({ targets, goal: targets ? goal : null }),
  setPlan: (plan) => set({ plan }),
  setPremium: (isPremium) => set({ isPremium }),
  swapMeal: (dayIndex, slot, meal) =>
    set((state) => {
      if (!state.plan) return {};
      const days = state.plan.days.map((day, i) =>
        i === dayIndex ? { ...day, meals: day.meals.map((m) => (m.slot === slot ? { slot, meal } : m)) } : day,
      );
      return { plan: { ...state.plan, days } };
    }),
}));
