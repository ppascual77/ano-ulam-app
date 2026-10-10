import { supabase } from "@/lib/supabase";
import type { MealWithIngredients } from "@/api/meals";

// Price Watch reads DA commodities directly (da_commodities + daily_prices,
// filled by Admin → DA Daily Prices), not `ingredients`: one row here is
// one DA commodity, e.g. "Bangus, Large". Nutrition comes from the
// ingredient a commodity is linked to, when it is.

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

export async function getPriceWatchCommodities() {
  const { data, error } = await supabase
    .from("da_commodities")
    .select(
      "id, commodity, specification, section, unit, unit_size, ingredient_id, latest_price, latest_price_date, ingredient:ingredients(calories, protein, carbohydrates, fat, basis_amount, basis_unit)",
    )
    .not("latest_price", "is", null)
    .order("commodity");
  if (error) throw error;
  return data;
}

// Daily prices of just these commodities on or after `since` (YYYY-MM-DD),
// oldest first: enough for a week-over-week change without loading every
// commodity (see getDailyPricesSince).
export async function getDailyPricesFor(commodityIds: string[], since: string) {
  if (commodityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("daily_prices")
    .select("da_commodity_id, price, price_date")
    .in("da_commodity_id", commodityIds)
    .gte("price_date", since)
    .order("price_date");
  if (error) throw error;
  return data;
}

// Every daily price on or after `since` (YYYY-MM-DD). ~200 rows per DA day,
// so this pages past PostgREST's row cap.
export async function getDailyPricesSince(since: string) {
  const rows: { da_commodity_id: string; price: number; price_date: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("daily_prices")
      .select("da_commodity_id, price, price_date")
      .gte("price_date", since)
      .order("price_date")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Approved, non-archived meals that use any of `ingredientIds`, with the
// ingredient that matched. Through meal_ingredients (real links), not a
// text search of ingredient names. Each meal comes with its own
// ingredients and their linked DA commodities (same join as api/meals.ts),
// so Meal Details opens complete, DA price sources included.
export async function getMealsUsingIngredientIds(ingredientIds: string[]) {
  if (ingredientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("meal_ingredients")
    .select(
      "ingredient_id, meal:meals!inner(*, meal_ingredients(*, ingredient:ingredients(*, da_commodities(id, commodity, specification, unit, unit_size, latest_price, latest_price_date))))",
    )
    .in("ingredient_id", ingredientIds)
    .eq("meal.status", "approved")
    .is("meal.archived_at", null);
  if (error) throw error;
  return data as unknown as { ingredient_id: string; meal: MealWithIngredients }[];
}
