import type { DraftIngredient } from "../types";
import type { RecipeTotals } from "./recipeTotals";

// Tags are computed, not picked by the user: ports of the web app's
// determineTagsFromMacros (computeFromDraft.ts) and determineDietaryTags.
// Thresholds are applied per serving, since "high protein" or "under ₱150"
// describe one plate, not the whole pot.

export type PerServing = { price: number; calories: number; protein: number; carbs: number; fats: number };

export function perServing(totals: RecipeTotals, servings: number): PerServing {
  const n = servings > 0 ? servings : 1;
  return {
    price: totals.price / n,
    calories: totals.calories / n,
    protein: totals.protein / n,
    carbs: totals.carbohydrates / n,
    fats: totals.fat / n,
  };
}

export function computeRecipeTags(serving: PerServing, totalTimeMinutes: number | null): string[] {
  const tags = ["user_published"];
  if (serving.protein >= 30) tags.push("high_protein");
  if (serving.calories <= 350) tags.push("low_calorie");
  if (serving.carbs <= 20) tags.push("low_carb");
  if (serving.protein >= 25 && serving.fats >= 20) tags.push("filling");
  if (totalTimeMinutes && totalTimeMinutes <= 20) tags.push("quick");
  if (serving.price <= 150) tags.push("under_150");
  if (serving.price <= 100) tags.push("budget_friendly");
  return tags;
}

const MEAT_KEYWORDS = /chicken|pork|beef|lamb|goat|duck|turkey|liver|meat|longganisa|tocino|sausage|hotdog|ham/i;
const FISH_KEYWORDS = /fish|shrimp|prawn|squid|crab|mussel|clam|tuna|salmon|tilapia|bangus|seafood|galunggong|pusit|hipon|talaba|oyster|scallop/i;
const DAIRY_KEYWORDS = /milk|cheese|cream|butter|yogurt/i;
const EGG_KEYWORDS = /\begg\b/i;
const GRAIN_KEYWORDS = /rice|flour|bread|pasta|noodle|oat|wheat|corn/i;
const LEGUME_KEYWORDS = /bean|lentil|\bpea\b|soy|tofu|chickpea/i;

export function computeDietaryTags(lines: DraftIngredient[], serving: PerServing): string[] {
  const names = lines.map((line) => (line.ingredient?.canonical_name ?? line.name).toLowerCase());
  const has = (pattern: RegExp) => names.some((name) => pattern.test(name));

  const hasMeat = has(MEAT_KEYWORDS);
  const hasFish = has(FISH_KEYWORDS);
  const hasDairy = has(DAIRY_KEYWORDS);
  const hasEgg = has(EGG_KEYWORDS);

  const tags: string[] = [];
  if (!hasMeat && !hasFish && !hasDairy && !hasEgg) tags.push("vegan");
  else if (!hasMeat && !hasFish) tags.push("vegetarian");
  else if (!hasMeat && hasFish) tags.push("pescatarian");

  if (serving.calories > 0) {
    const carbShare = (serving.carbs * 4) / serving.calories;
    const fatShare = (serving.fats * 9) / serving.calories;
    if (carbShare < 0.2 && fatShare > 0.5) tags.push("keto");
  }

  if (!has(GRAIN_KEYWORDS) && !has(LEGUME_KEYWORDS) && !hasDairy) tags.push("paleo");
  return tags;
}
