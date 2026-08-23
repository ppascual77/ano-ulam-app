import type { MealType } from "@/frontend/core/meals/mealTypes";

// Same shared placeholder photo used by core/meals/mocks/meals.ts entries
// without a meal-specific image yet.
const PLACEHOLDER_IMAGE =
  "https://uwtbxqpoysxgmuiosfos.supabase.co/storage/v1/object/public/meal-images/meals/a74c99ae-ed20-4aa6-aac9-993575781572.jpg";

type MoodMealInput = {
  id: string;
  name: string;
  price: number;
  bufferPrice?: number;
  totalTime: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

function moodMeal({ id, name, price, bufferPrice, totalTime, calories, protein, carbs, fats }: MoodMealInput): MealType {
  return {
    id,
    name,
    description: "",
    price: String(price),
    buffer_price: bufferPrice,
    total_time: totalTime,
    calories,
    protein,
    carbs,
    fats,
    image_url: PLACEHOLDER_IMAGE,
  };
}

// Mock only — MoodSelection (features/browse) is the only consumer, so
// this stays local instead of living in core/meals/mocks.
export const MOOD_MEALS = {
  tipid: [
    moodMeal({ id: "mood-tipid-1", name: "Paksiw na Galunggong", price: 70, bufferPrice: 80, totalTime: 30, calories: 270, protein: 24, carbs: 10, fats: 12 }),
    moodMeal({ id: "mood-tipid-2", name: "Scrambled Egg with Tomato and Onion", price: 50, bufferPrice: 60, totalTime: 12, calories: 285, protein: 14, carbs: 8, fats: 20 }),
    moodMeal({ id: "mood-tipid-3", name: "Ginataang Puso ng Saging", price: 60, bufferPrice: 70, totalTime: 40, calories: 425, protein: 10, carbs: 35, fats: 28 }),
    moodMeal({ id: "mood-tipid-4", name: "Pork Pochero", price: 115, bufferPrice: 130, totalTime: 65, calories: 684, protein: 38, carbs: 40, fats: 42 }),
    moodMeal({ id: "mood-tipid-5", name: "Ginisang Munggo", price: 45, bufferPrice: 55, totalTime: 25, calories: 260, protein: 16, carbs: 30, fats: 8 }),
    moodMeal({ id: "mood-tipid-6", name: "Tinolang Manok", price: 90, bufferPrice: 110, totalTime: 45, calories: 310, protein: 28, carbs: 15, fats: 12 }),
    moodMeal({ id: "mood-tipid-7", name: "Pinakbet", price: 55, bufferPrice: 65, totalTime: 35, calories: 220, protein: 8, carbs: 25, fats: 10 }),
    moodMeal({ id: "mood-tipid-8", name: "Sinigang na Baboy", price: 120, bufferPrice: 140, totalTime: 50, calories: 380, protein: 26, carbs: 20, fats: 22 }),
  ],
  highProtein: [
    moodMeal({ id: "mood-protein-1", name: "Grilled Bangus", price: 90, bufferPrice: 110, totalTime: 25, calories: 320, protein: 34, carbs: 4, fats: 18 }),
    moodMeal({ id: "mood-protein-2", name: "Chicken Tapa", price: 75, bufferPrice: 90, totalTime: 20, calories: 350, protein: 32, carbs: 18, fats: 16 }),
    moodMeal({ id: "mood-protein-3", name: "Beef Tapa", price: 95, bufferPrice: 115, totalTime: 20, calories: 380, protein: 36, carbs: 16, fats: 20 }),
    moodMeal({ id: "mood-protein-4", name: "Tokwa't Baboy", price: 65, bufferPrice: 80, totalTime: 30, calories: 300, protein: 30, carbs: 10, fats: 18 }),
    moodMeal({ id: "mood-protein-5", name: "Chicken Adobo", price: 80, bufferPrice: 95, totalTime: 35, calories: 340, protein: 33, carbs: 8, fats: 19 }),
    moodMeal({ id: "mood-protein-6", name: "Bistek Tagalog", price: 100, bufferPrice: 120, totalTime: 25, calories: 360, protein: 35, carbs: 14, fats: 18 }),
    moodMeal({ id: "mood-protein-7", name: "Tuna Sisig", price: 85, bufferPrice: 100, totalTime: 15, calories: 290, protein: 31, carbs: 6, fats: 15 }),
    moodMeal({ id: "mood-protein-8", name: "Egg and Corned Beef", price: 60, bufferPrice: 70, totalTime: 15, calories: 310, protein: 30, carbs: 10, fats: 20 }),
  ],
  quickEasy: [
    moodMeal({ id: "mood-quick-1", name: "Instant Pancit Canton", price: 25, bufferPrice: 35, totalTime: 8, calories: 380, protein: 8, carbs: 55, fats: 14 }),
    moodMeal({ id: "mood-quick-2", name: "Tortang Talong", price: 35, bufferPrice: 45, totalTime: 15, calories: 220, protein: 9, carbs: 12, fats: 15 }),
    moodMeal({ id: "mood-quick-3", name: "Corned Beef Fried Rice", price: 55, bufferPrice: 65, totalTime: 12, calories: 410, protein: 16, carbs: 48, fats: 17 }),
    moodMeal({ id: "mood-quick-4", name: "Egg Sandwich", price: 30, bufferPrice: 40, totalTime: 10, calories: 280, protein: 11, carbs: 30, fats: 13 }),
    moodMeal({ id: "mood-quick-5", name: "Hotdog and Rice", price: 40, bufferPrice: 50, totalTime: 10, calories: 350, protein: 10, carbs: 45, fats: 14 }),
    moodMeal({ id: "mood-quick-6", name: "Spam Musubi", price: 45, bufferPrice: 55, totalTime: 15, calories: 320, protein: 9, carbs: 38, fats: 15 }),
    moodMeal({ id: "mood-quick-7", name: "Tuna Pandesal", price: 35, bufferPrice: 45, totalTime: 8, calories: 260, protein: 14, carbs: 28, fats: 10 }),
    moodMeal({ id: "mood-quick-8", name: "Cheese Omelette", price: 30, bufferPrice: 40, totalTime: 10, calories: 240, protein: 13, carbs: 4, fats: 19 }),
  ],
} as const satisfies Record<string, MealType[]>;

export type MoodId = keyof typeof MOOD_MEALS;
