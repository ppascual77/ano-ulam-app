import { supabase } from "@/lib/supabase";
import {
  addMealIngredient,
  createMeal,
  recomputeMealTotals,
  updateMeal,
  uploadMealImage,
  type MealRow,
  type QuantityUnit,
} from "./meals";

// User-submitted recipes ("Add a Recipe") and their admin review. A
// submission is an ordinary `meals` row with status 'pending' and the
// poster's id; price and macros come from its linked ingredients through
// the same recomputeMealTotals as admin-seeded meals. See migration
// 20261003030000_meals_moderation.sql.

// Same cap as the web app.
export const RECIPE_LIMIT = 8;

// An ingredient line that didn't match the canonical ingredients table,
// stored on the meal (meals.unlinked_ingredients) until an admin links it.
export type UnlinkedIngredient = {
  name: string;
  display_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
};

export type RecipeIngredientSubmission =
  | {
      kind: "linked";
      ingredient_id: string;
      display_text: string;
      quantity_amount: number | null;
      quantity_unit: QuantityUnit | null;
    }
  | ({ kind: "unlinked" } & UnlinkedIngredient);

export type RecipeSubmission = {
  name: string;
  description: string;
  /** Local file uri from the image picker, uploaded on submit. */
  coverPhotoUri: string | null;
  prepTimeMinutes: number;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  /** Computed from the recipe (macros, price, time), not user-picked. */
  tags: string[];
  /** Computed: vegan / vegetarian / pescatarian / keto / paleo. */
  dietaryTags: string[];
  ingredients: RecipeIngredientSubmission[];
  steps: string[];
};

// Counts toward RECIPE_LIMIT: anything the user has submitted that isn't
// rejected (pending + approved + drafts).
export async function countMyRecipes(posterId: string): Promise<number> {
  const { count, error } = await supabase
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("poster_id", posterId)
    .neq("status", "rejected");
  if (error) throw error;
  return count ?? 0;
}

// Everything the user has submitted, any status, newest first (Profile's
// Created tab). `posterId` null = dev-build submissions made without a
// session (see submitRecipe): those are matched by poster_id null plus the
// user_published tag every submission carries, so seeded catalog meals
// (also poster_id null) stay out.
export async function listMyRecipes(posterId: string | null): Promise<MealRow[]> {
  let query = supabase.from("meals").select("*").is("archived_at", null).order("created_at", { ascending: false });
  query = posterId ? query.eq("poster_id", posterId) : query.is("poster_id", null).contains("tags", ["user_published"]);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Another user's published recipes (their profile's Created tab): approved
// only, newest first.
export async function listApprovedRecipesByPoster(posterId: string): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("poster_id", posterId)
    .eq("status", "approved")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Creates the pending meal, uploads its cover photo, adds the linked
// ingredients, keeps the unmatched ones for review, then computes price
// and macros. `posterId` is null only for dev-build test submissions made
// without a session (Google sign-in can't complete in Expo Go on a device).
export async function submitRecipe(submission: RecipeSubmission, posterId: string | null): Promise<MealRow> {
  const unlinked = submission.ingredients.filter((i) => i.kind === "unlinked").map(({ kind: _kind, ...rest }) => rest);

  const meal = await createMeal({
    name: submission.name.trim(),
    description: submission.description.trim(),
    category: "luto",
    prep_time: submission.prepTimeMinutes,
    total_time: submission.prepTimeMinutes,
    difficulty: submission.difficulty,
    serving_size: submission.servings,
    procedure: submission.steps.map((s) => s.trim()).filter(Boolean),
    tags: submission.tags,
    dietary_tags: submission.dietaryTags,
    source_type: "estimated",
    status: "pending",
    poster_id: posterId,
    unlinked_ingredients: unlinked,
  });

  if (submission.coverPhotoUri) {
    const imageUrl = await uploadMealImage(submission.coverPhotoUri, meal.id);
    await updateMeal(meal.id, { image_url: imageUrl });
  }

  let sortOrder = 0;
  for (const item of submission.ingredients) {
    if (item.kind !== "linked") continue;
    await addMealIngredient(meal.id, {
      ingredient_id: item.ingredient_id,
      quantity_amount: item.quantity_amount,
      quantity_unit: item.quantity_unit,
      display_text: item.display_text,
      sort_order: sortOrder++,
    });
  }

  await recomputeMealTotals(meal.id);
  return meal;
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

export async function getPendingRecipes(): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export function getUnlinkedIngredients(meal: Pick<MealRow, "unlinked_ingredients">): UnlinkedIngredient[] {
  return Array.isArray(meal.unlinked_ingredients) ? (meal.unlinked_ingredients as UnlinkedIngredient[]) : [];
}

// Turns one unmatched line into a real meal_ingredients row (the admin
// picked the canonical ingredient and confirmed the quantity), removes it
// from the unlinked list, and recomputes the meal's totals.
export async function linkUnlinkedIngredient(
  mealId: string,
  index: number,
  link: { ingredient_id: string; quantity_amount: number | null; quantity_unit: QuantityUnit | null },
) {
  const { data: meal, error } = await supabase
    .from("meals")
    .select("unlinked_ingredients")
    .eq("id", mealId)
    .single();
  if (error) throw error;
  const unlinked = getUnlinkedIngredients(meal);
  const item = unlinked[index];
  if (!item) throw new Error("That ingredient was already linked. Refresh and try again.");

  const { count } = await supabase
    .from("meal_ingredients")
    .select("id", { count: "exact", head: true })
    .eq("meal_id", mealId);

  await addMealIngredient(mealId, {
    ingredient_id: link.ingredient_id,
    quantity_amount: link.quantity_amount,
    quantity_unit: link.quantity_unit,
    display_text: item.display_text,
    sort_order: count ?? 0,
  });
  await updateMeal(mealId, { unlinked_ingredients: unlinked.filter((_, i) => i !== index) });
  await recomputeMealTotals(mealId);
}

export async function approveRecipe(mealId: string) {
  const { data: meal, error } = await supabase
    .from("meals")
    .select("unlinked_ingredients")
    .eq("id", mealId)
    .single();
  if (error) throw error;
  if (getUnlinkedIngredients(meal).length > 0) {
    throw new Error("Link every flagged ingredient before approving.");
  }
  await updateMeal(mealId, { status: "approved", rejection_reason: null });
}

export async function rejectRecipe(mealId: string, reason: string) {
  await updateMeal(mealId, { status: "rejected", rejection_reason: reason.trim() });
}
