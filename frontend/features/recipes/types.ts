import type { IngredientRow } from "@/api/ingredients";
import type { QuantityUnit } from "@/api/meals";

// The Add a Recipe draft while the user fills it in (screen state only;
// nothing is saved until Publish). Limits and validation copy match the
// web app's CreateRecipeFlow steps.

export const NAME_MAX = 50;
export const SERVINGS_MAX = 10;
export const STEPS_MAX = 12;
export const MIN_INGREDIENTS = 3;

export const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number]["id"];

export type DraftUnit = QuantityUnit | "to taste";
export const UNITS: DraftUnit[] = ["g", "kg", "ml", "L", "piece", "to taste"];

export type DraftIngredient = {
  key: string;
  /** The matched canonical ingredient; null = free text the admin links on review. */
  ingredient: IngredientRow | null;
  name: string;
  amount: string;
  unit: DraftUnit;
};

export type RecipeDraft = {
  name: string;
  description: string;
  coverPhotoUri: string | null;
  prepTime: string;
  /** Digits as typed; see servingsCount. */
  servings: string;
  difficulty: Difficulty;
  ingredients: DraftIngredient[];
  steps: string[];
};

export const EMPTY_DRAFT: RecipeDraft = {
  name: "",
  description: "",
  coverPhotoUri: null,
  prepTime: "",
  servings: "",
  difficulty: "easy",
  ingredients: [],
  steps: [""],
};

export type StepErrors = Record<string, string>;

export function validateDetails(draft: RecipeDraft): StepErrors {
  const errors: StepErrors = {};
  if (!draft.name.trim()) errors.name = "Recipe name is required";
  else if (draft.name.length > NAME_MAX) errors.name = `Max ${NAME_MAX} characters`;
  if (!draft.description.trim()) errors.description = "Description is required";
  if (!draft.prepTime || Number(draft.prepTime) <= 0) errors.prepTime = "Prep time is required";
  const servings = Number(draft.servings);
  if (!draft.servings || servings < 1) errors.servings = "Servings is required";
  else if (servings > SERVINGS_MAX) errors.servings = `Max ${SERVINGS_MAX} servings`;
  return errors;
}

// Servings as a number for the math (at least 1, so per-serving values
// never divide by zero while the field is empty mid-edit).
export function servingsCount(draft: Pick<RecipeDraft, "servings">): number {
  return Math.max(1, Number(draft.servings) || 1);
}

export function validateIngredients(draft: RecipeDraft): StepErrors {
  const errors: StepErrors = {};
  if (draft.ingredients.length < MIN_INGREDIENTS) errors.ingredients = `Add at least ${MIN_INGREDIENTS} ingredients`;
  else if (!draft.ingredients.some((i) => i.ingredient?.role === "main")) {
    errors.main = "Add at least one main ingredient (like a meat, fish, or vegetable)";
  }
  if (draft.ingredients.some((i) => i.unit !== "to taste" && !(Number(i.amount) > 0))) {
    errors.qty = "All ingredients must have a quantity greater than 0";
  }
  return errors;
}

export function validateSteps(draft: RecipeDraft): StepErrors {
  return draft.steps.some((s) => s.trim()) ? {} : { steps: "Add at least one step" };
}

// The quantity as shown in the recipe ("2 pieces", "250 g", "to taste"),
// stored as meal_ingredients.display_text.
export function displayQuantity(line: DraftIngredient): string {
  if (line.unit === "to taste") return "to taste";
  if (line.unit === "piece") {
    const label = line.ingredient?.piece_label ?? "piece";
    return `${line.amount} ${Number(line.amount) === 1 ? label : `${label}s`}`;
  }
  return `${line.amount} ${line.unit}`;
}

// A sensible starting unit for a freshly picked ingredient: pieces when it
// has a per-piece weight (eggs, onions), otherwise its basis unit.
export function defaultUnit(ingredient: IngredientRow): DraftUnit {
  if (ingredient.grams_per_piece) return "piece";
  return ingredient.basis_unit === "ml" ? "ml" : "g";
}
