import type { MealRow, MealWithIngredients } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { IngredientType, MealType } from "@/frontend/core/meals/mealTypes";
import { displayQuantity, servingsCount, type RecipeDraft } from "../types";
import { recipeTotals } from "./recipeTotals";
import { computeDietaryTags, computeRecipeTags, perServing } from "./recipeTags";

// The tags a recipe gets, computed from its ingredients, macros, price and
// time. Shared by the preview and the submission so they always agree.
export function draftTags(draft: RecipeDraft): { tags: string[]; dietaryTags: string[] } {
  const serving = perServing(recipeTotals(draft.ingredients), servingsCount(draft));
  return {
    tags: computeRecipeTags(serving, Number(draft.prepTime) || null),
    dietaryTags: computeDietaryTags(draft.ingredients, serving),
  };
}

// Turns the draft into a MealType by building the same rows a saved recipe
// would have (a meal row plus meal_ingredients joined to their ingredients)
// and running them through the same adapter real meals use. That way the
// Preview step renders exactly what the published meal details will show:
// same quantities, per-ingredient price/macros, nutrition and price sources.
export function draftToMeal(draft: RecipeDraft): MealType {
  const totals = recipeTotals(draft.ingredients);
  const { tags, dietaryTags } = draftTags(draft);

  const row = {
    id: "draft",
    name: draft.name,
    description: draft.description,
    category: "luto",
    price: totals.price,
    calories: totals.calories,
    protein: totals.protein,
    carbohydrates: totals.carbohydrates,
    fat: totals.fat,
    prep_time: Number(draft.prepTime) || null,
    total_time: Number(draft.prepTime) || null,
    difficulty: draft.difficulty,
    serving_size: servingsCount(draft),
    procedure: draft.steps.map((s) => s.trim()).filter(Boolean),
    image_url: draft.coverPhotoUri,
    tags,
    allergens: [],
    dietary_tags: dietaryTags,
  } as unknown as MealRow;

  const linkedRows = draft.ingredients.flatMap((line, i) =>
    line.ingredient
      ? [
          {
            id: line.key,
            meal_id: "draft",
            ingredient_id: line.ingredient.id,
            quantity_amount: line.unit === "to taste" ? null : Number(line.amount) || null,
            quantity_unit: line.unit === "to taste" ? null : line.unit,
            display_text: displayQuantity(line),
            sort_order: i,
            note: null,
            price_quantity_amount: null,
            price_quantity_unit: null,
            created_at: "",
            ingredient: line.ingredient,
          },
        ]
      : [],
  ) as MealWithIngredients["meal_ingredients"];

  const meal = mealRowToMealType(row, linkedRows);

  // Free-text lines have no ingredient data yet (an admin links them on
  // review), so they show with just their name and quantity.
  const unlinked: IngredientType[] = draft.ingredients
    .filter((line) => !line.ingredient)
    .map((line) => ({ qty: displayQuantity(line), name: line.name, type: "pantry" }));

  return { ...meal, id: undefined, ingredients: [...(meal.ingredients ?? []), ...unlinked] };
}
