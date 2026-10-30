import { parseQuantityText, type ImportedMealDraft, type MealIngredientInput, type MealRow } from "@/api/meals";
import type { MealFormState } from "../components/MealFormFields";
import type { PendingMealIngredient } from "../components/SeedMealIngredientsEditor";

// Seed Meal's import → form → save mapping, pure so the Seed Meal screen
// and the /seed-meal Claude Code skill (.claude/skills/seed-meal) build and
// save meals the exact same way.

function draftIngredientsToPending(draft: ImportedMealDraft): PendingMealIngredient[] {
  return draft.ingredients.map((ing, i) => {
    // Best-effort prefill from the LLM's free-text quantity ("2 pieces",
    // "500 g") — the amount is a fact about this recipe, not something the
    // ingredients DB can supply, so this is a parse of what's already in
    // the text, not a calculation. Units this schema doesn't model fall
    // through and stay blank for the admin to set.
    const parsed = parseQuantityText(ing.quantity_text);
    return {
      key: `imported-${i}`,
      name: ing.name,
      quantityAmount: parsed?.amount ?? "",
      quantityUnit: parsed?.unit ?? "g",
      displayText: ing.quantity_text,
      note: "",
      section: ing.section?.trim() ?? "",
      priceQuantityAmount: "",
      priceQuantityUnit: "",
      ingredientId: null,
      ingredientName: null,
    };
  });
}

export function draftToFormState(draft: ImportedMealDraft): MealFormState {
  return {
    name: draft.name,
    description: draft.description,
    prepTime: draft.prep_time?.toString() ?? "",
    totalTime: draft.total_time?.toString() ?? "",
    servingSize: draft.servings?.toString() ?? "1",
    difficulty: draft.difficulty ? [draft.difficulty] : [],
    proteinType: draft.protein_type ?? "",
    restaurant: "",
    source: "",
    budgetRange: "",
    dietaryTags: draft.dietary_tags,
    tags: draft.tags,
    allergens: draft.allergens,
    procedure: draft.procedure,
    ingredients: draftIngredientsToPending(draft),
  };
}

// The lines that count: blank rows the admin added and never filled are
// dropped, same as before saving.
export function filledIngredients(form: MealFormState): PendingMealIngredient[] {
  return form.ingredients.filter((i) => i.name.trim() !== "");
}

export function mealInsertFromForm(draft: ImportedMealDraft, form: MealFormState): Partial<MealRow> & { name: string } {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: draft.category,
    difficulty: form.difficulty[0] ?? null,
    protein_type: form.proteinType.trim() || null,
    restaurant: form.restaurant.trim() || null,
    source: form.source.trim() || null,
    budget_range: form.budgetRange.trim() || null,
    prep_time: form.prepTime ? Number(form.prepTime) : null,
    total_time: form.totalTime ? Number(form.totalTime) : null,
    serving_size: Number(form.servingSize) || 1,
    procedure: form.procedure.map((s) => s.trim()).filter(Boolean),
    allergens: form.allergens,
    dietary_tags: form.dietaryTags,
    tags: form.tags,
    source_type: "ai_estimated",
    reference_image_url: draft.reference_image_url,
  };
}

export function mealIngredientInput(item: PendingMealIngredient, sortOrder: number): MealIngredientInput {
  return {
    ingredient_id: item.ingredientId as string,
    quantity_amount: item.quantityAmount.trim() === "" ? null : Number(item.quantityAmount),
    quantity_unit: item.quantityAmount.trim() === "" ? null : item.quantityUnit,
    display_text: item.displayText.trim() || item.name,
    note: item.note.trim() || null,
    section: item.section.trim() || null,
    price_quantity_amount: item.priceQuantityAmount.trim() === "" ? null : Number(item.priceQuantityAmount),
    price_quantity_unit: item.priceQuantityAmount.trim() === "" ? null : item.priceQuantityUnit,
    sort_order: sortOrder,
  };
}
