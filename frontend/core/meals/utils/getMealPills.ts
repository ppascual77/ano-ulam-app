import type { MealPillType, PillType } from "../mealTypes";
import { MACRO_RULES, NON_MACRO_RULES, MACRO_PILLS_CONFIG, NON_NUTRITION_PILLS_CONFIG } from "./constants";

export default function getMealPills(meal: MealPillType) {
  let macroPill = null;
  let nonMacroPill = null;

  for (const key of Object.keys(MACRO_RULES) as Array<keyof typeof MACRO_RULES>) {
    if (MACRO_RULES[key](meal)) {
      macroPill = MACRO_PILLS_CONFIG[key];
      break;
    }
  }

  for (const key of Object.keys(NON_MACRO_RULES) as Array<keyof typeof NON_MACRO_RULES>) {
    if (NON_MACRO_RULES[key](meal)) {
      nonMacroPill = NON_NUTRITION_PILLS_CONFIG[key];
      break;
    }
  }

  return [macroPill, nonMacroPill].filter((pill): pill is PillType => Boolean(pill));
}
