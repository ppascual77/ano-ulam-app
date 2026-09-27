import type { LucideIcon } from "lucide-react-native";

export type IngredientType = {
  qty: string;
  name: string;
  type: "main" | "pantry";
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
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
  // block in IngredientDetailPanel. Same admin-only-diagnostic population
  // rule as bridgeLabel/calculationError/source above.
  sourceRefId?: string | null;
  sourceDescription?: string | null;
  // NOT admin-only — a plain explanation shown to any viewer when the
  // counted quantity differs from `qty` (e.g. bulk deep-frying oil where
  // only a fraction is actually absorbed). Set by an admin, read by
  // everyone.
  note?: string | null;
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
