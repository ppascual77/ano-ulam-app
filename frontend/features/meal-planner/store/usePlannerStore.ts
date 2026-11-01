import { create } from "zustand";
import type { Goal, MacroTargets } from "../utils/macros";
import type { MealPlan, PlannedMeal } from "../utils/generatePlan";
import type { MealSlot, PlannerMeal } from "../utils/generatePlan";

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
  /** Whose saved plan has been loaded in (useSavedMealPlan), so it loads
   *  once per account, not on every screen that shows it. */
  loadedFor: string | null;
  setStage: (stage: PlannerStage) => void;
  setBudget: (budget: string) => void;
  setServings: (servings: number) => void;
  setTargets: (targets: MacroTargets | null, goal?: Goal | null) => void;
  setPlan: (plan: MealPlan | null) => void;
  swapMeal: (dayIndex: number, slot: MealSlot, meal: PlannerMeal) => void;
  replaceDay: (dayIndex: number, meals: PlannedMeal[]) => void;
  /** The saved plan's inputs (and the plan, when it's still running), for
   *  `userId`. */
  loadSaved: (
    userId: string,
    saved: { budget: string; servings: number; targets: MacroTargets | null; goal: Goal | null; plan: MealPlan | null } | null,
  ) => void;
};

const INITIAL = { stage: "setup" as PlannerStage, budget: "", servings: 1, targets: null, goal: null, plan: null };

// Meal Planner state. Event-driven (setup -> generating -> plan), and kept
// across screens, so a store rather than screen state. The plan itself is
// saved to the account (useSavedMealPlan) and loaded back in here.
export const usePlannerStore = create<PlannerStore>((set) => ({
  ...INITIAL,
  loadedFor: null,
  setStage: (stage) => set({ stage }),
  setBudget: (budget) => set({ budget }),
  setServings: (servings) => set({ servings }),
  setTargets: (targets, goal = null) => set({ targets, goal: targets ? goal : null }),
  setPlan: (plan) => set({ plan }),
  swapMeal: (dayIndex, slot, meal) =>
    set((state) => {
      if (!state.plan) return {};
      const days = state.plan.days.map((day, i) =>
        i === dayIndex ? { ...day, meals: day.meals.map((m) => (m.slot === slot ? { slot, meal } : m)) } : day,
      );
      return { plan: { ...state.plan, days } };
    }),
  // Another account's plan never carries over: everything starts fresh for
  // the new one first.
  loadSaved: (userId, saved) =>
    set(
      saved
        ? {
            ...INITIAL,
            loadedFor: userId,
            budget: saved.budget,
            servings: saved.servings,
            targets: saved.targets,
            goal: saved.goal,
            plan: saved.plan,
            stage: saved.plan ? "plan" : "setup",
          }
        : { ...INITIAL, loadedFor: userId },
    ),
  replaceDay: (dayIndex, meals) =>
    set((state) =>
      state.plan ? { plan: { ...state.plan, days: state.plan.days.map((day, i) => (i === dayIndex ? { ...day, meals } : day)) } } : {},
    ),
}));
