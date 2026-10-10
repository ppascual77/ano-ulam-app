import type { LucideIcon } from "lucide-react-native";

// One supermarket listing an ingredient's price was averaged from (see
// ingredients.price_sources). pricePerUnit is ₱ per `unit` (kg or L).
export type PriceSourceType = {
  store: string;
  productTitle: string;
  packPrice: number;
  packSize: number;
  packUnit: string;
  url: string;
  pricePerUnit: number;
  unit: string;
};

// The DA Daily Price Index price of a commodity an ingredient is linked to
// (ingredients ← da_commodities.ingredient_id, can be several, e.g. Bangus
// ← "Bangus, Large" and "Bangus, Medium"): the average across NCR
// wet markets. pricePerUnit is converted to ₱ per `unit` (kg or L) so it
// compares directly with the supermarket listings.
export type DaPriceSourceType = {
  /** da_commodities.id, for its week-over-week change. Absent on mocks. */
  commodityId?: string;
  commodity: string;
  specification: string;
  pricePerUnit: number;
  unit: string;
  date: string;
};

export type IngredientType = {
  qty: string;
  name: string;
  type: "main" | "pantry";
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  // Micronutrients at the quantity used (same scaling as the macros): fiber
  // and sugar in grams, sodium in milligrams. Undefined when the ingredient
  // has no data for them (e.g. mock meals).
  fiber?: number;
  sugar?: number;
  sodium?: number;
  price?: number;
  // Admin-only diagnostics — only ever populated when mealRowToMealType
  // (frontend/core/meals/utils/mealAdapter.ts) is given real ingredient
  // rows with a join (Manage Meals), never by mock data or by the bulk,
  // no-join meal lists consumer screens use, so these stay undefined (and
  // render nothing extra) everywhere else this type is used.
  bridgeLabel?: string | null;
  calculationError?: string | null;
  source?: string | null;
  // Only meaningful when source === "USDA" — the matched USDA record's own
  // description and FDC id, for the USDA FoodData Central attribution
  // block in IngredientDetailSheet. Same admin-only-diagnostic population
  // rule as bridgeLabel/calculationError/source above.
  sourceRefId?: string | null;
  sourceDescription?: string | null;
  // NOT admin-only — a plain explanation shown to any viewer when the
  // counted quantity differs from `qty` (e.g. bulk deep-frying oil where
  // only a fraction is actually absorbed). Set by an admin, read by
  // everyone.
  note?: string | null;
  // The ingredients table's category (e.g. "Pork", "Leafy Green"), for the
  // row's category icon (see core/meals/ingredientCategory.ts). Undefined for
  // mock meals, which fall back to a guess from the name.
  category?: string | null;
  // Where the ingredient's price came from: the cheapest of its sources,
  // "supermarket" (priceSources, from Ground Prices) or "da" (daPriceSources);
  // "manual" = an estimate. Shown to every viewer in IngredientDetailSheet's
  // price source section. Populated only from joined ingredient rows, same
  // as `source` above.
  priceSource?: string | null;
  priceSources?: PriceSourceType[];
  daPriceSources?: DaPriceSourceType[];
  // Set when the recipe's quantity text was a bare number ("1") and `qty`
  // was generated from the stored amount + count label instead ("1 clove").
  // Kept separately so scaling servings can re-pluralize ("2 cloves")
  // rather than just swapping the number.
  count?: { amount: number; label: string };
};

export type MealType = {
  id?: string;
  name: string;
  description: string;
  category?: string;
  price: string;
  budget_range?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  prep_time?: number;
  total_time?: number;
  difficulty?: "easy" | "medium" | "hard";
  protein_type?: string;
  ingredients?: IngredientType[];
  procedure?: string[];
  restaurant?: string | null;
  source?: string | null;
  source_type?: "official" | "estimated" | "ai_estimated" | null;
  image_url?: string | null;
  allergens?: string[];
  dietary_tags?: string[];
  tags?: string[];
  created_at?: string;
  buffer_price?: number;
  normalized_name?: string;
  ingredient_sig?: string;
  image_attribution?: string | null;
  like_count?: number;
  poster_id?: string | null;
  serving_size?: number;
  status?: string;
  rejection_reason?: string | null;
  updated_at?: string;
  ingredients_synced_at?: string | null;
  liked_by_me?: boolean;
};

export type MacroType = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MealPillType = MacroType & {
  total_time?: number;
};

export type PillType = {
  label: string;
  bgColor: string;
  icon: LucideIcon;
};
