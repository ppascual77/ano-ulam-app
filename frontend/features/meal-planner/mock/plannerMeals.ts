import type { MealType } from "@/frontend/core/meals/mealTypes";

// MOCK — the Meal Planner's own meal catalog, for testing the flow. The
// real catalog can't fill a week yet (a handful of meals, no breakfasts,
// mostly ₱400+), so the planner draws from these plus any real meals that
// fit the budget (see usePlannerPool). Prices are per person, single
// serving, roughly what these cost at home. No images yet: cards show a
// placeholder until the hero/meal assets arrive.

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type PlannerMeal = MealType & { slots: MealSlot[] };

type Seed = [name: string, slots: MealSlot[], price: number, kcal: number, protein: number, carbs: number, fats: number, description: string];

// Main protein, for the Swap sheet's filter chips.
const PROTEIN_TYPE: Record<string, string> = {
  "Oatmeal with Banana and Peanut Butter": "veg",
  "Egg and Tomato with Garlic Rice": "egg",
  "Tuna and Egg with Rice": "seafood",
  "Chicken Longganisa with Rice and Egg": "chicken",
  "Champorado with Tuyo": "seafood",
  "Pandesal with Cheese and Egg": "egg",
  "Chicken Adobo with Rice": "chicken",
  "Sinigang na Baboy": "pork",
  "Ginisang Monggo with Rice": "veg",
  "Tinolang Manok": "chicken",
  "Pinakbet with Rice": "veg",
  "Pritong Tilapia with Rice": "seafood",
  "Tortang Talong with Rice": "veg",
  "Bistek Tagalog with Rice": "beef",
  "Ginisang Sayote with Chicken": "chicken",
  "Pancit Bihon": "chicken",
  "Laing with Rice": "veg",
  "Inihaw na Liempo with Rice": "pork",
};

const MAINS: MealSlot[] = ["lunch", "dinner"];

const SEEDS: Seed[] = [
  // Breakfast
  ["Oatmeal with Banana and Peanut Butter", ["breakfast"], 45, 450, 20, 68, 12, "Warm oats topped with sliced banana and a spoon of peanut butter."],
  ["Egg and Tomato with Garlic Rice", ["breakfast"], 40, 420, 28, 52, 12, "Scrambled eggs with sautéed tomatoes over sinangag."],
  ["Tuna and Egg with Rice", ["breakfast"], 55, 440, 36, 50, 14, "Pan-fried tuna flakes and a sunny-side egg with rice."],
  ["Chicken Longganisa with Rice and Egg", ["breakfast"], 65, 520, 32, 60, 18, "Sweet garlicky longganisa, fried egg and garlic rice."],
  ["Champorado with Tuyo", ["breakfast"], 38, 480, 18, 80, 10, "Chocolate rice porridge with crispy dried fish on the side."],
  ["Pandesal with Cheese and Egg", ["breakfast"], 35, 390, 20, 45, 14, "Toasted pandesal filled with egg and a slice of cheese."],
  // Lunch / dinner
  ["Chicken Adobo with Rice", MAINS, 75, 620, 42, 58, 22, "Chicken simmered in soy, vinegar, garlic and bay leaf."],
  ["Sinigang na Baboy", MAINS, 90, 560, 32, 45, 26, "Sour tamarind soup with pork and vegetables."],
  ["Ginisang Monggo with Rice", MAINS, 45, 480, 22, 72, 10, "Mung bean stew with malunggay and a little pork."],
  ["Tinolang Manok", MAINS, 80, 450, 38, 30, 16, "Ginger chicken soup with sayote and dahon ng sili."],
  ["Pinakbet with Rice", MAINS, 50, 430, 14, 65, 12, "Mixed vegetables sautéed with bagoong."],
  ["Pritong Tilapia with Rice", MAINS, 70, 560, 40, 55, 18, "Crispy fried tilapia with rice and tomato salsa."],
  ["Tortang Talong with Rice", MAINS, 40, 440, 18, 58, 14, "Eggplant omelette with rice and banana ketchup."],
  ["Bistek Tagalog with Rice", MAINS, 95, 610, 40, 58, 22, "Beef in soy-calamansi sauce with onion rings."],
  ["Ginisang Sayote with Chicken", MAINS, 55, 420, 30, 45, 12, "Sautéed chayote with chicken strips and garlic."],
  ["Pancit Bihon", MAINS, 60, 500, 22, 70, 14, "Rice noodles with vegetables and chicken."],
  ["Laing with Rice", MAINS, 50, 470, 12, 62, 20, "Taro leaves in spicy coconut milk."],
  ["Inihaw na Liempo with Rice", MAINS, 110, 720, 34, 55, 40, "Grilled pork belly with atchara and rice."],
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const PLANNER_MEALS: PlannerMeal[] = SEEDS.map(([name, slots, price, calories, protein, carbs, fats, description]) => ({
  // Prefixed so these never collide with (or get looked up as) real meal ids.
  id: `planner-${slug(name)}`,
  name,
  normalized_name: slug(name).replace(/-/g, ""),
  description,
  category: "luto",
  price: price.toFixed(2),
  calories,
  protein,
  carbs,
  fats,
  serving_size: 1,
  image_url: null,
  protein_type: PROTEIN_TYPE[name],
  slots,
}));
