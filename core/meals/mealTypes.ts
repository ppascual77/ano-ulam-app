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
