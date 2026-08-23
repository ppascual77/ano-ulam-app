import { Zap, BicepsFlexed, ArrowDown, ArrowUp, Droplets, Leaf, Flame, Scale, Clock } from "lucide-react-native";
import type { MealPillType } from "../mealTypes";

export const MACRO_PILLS_CONFIG = {
  highProtein: {
    label: "High Protein",
    bgColor: "#16A34A",
    icon: BicepsFlexed,
  },
  lowCarb: {
    label: "Low Carb",
    bgColor: "#2563EB",
    icon: ArrowDown,
  },
  highCarb: {
    label: "High Carb",
    bgColor: "#EA580C",
    icon: ArrowUp,
  },
  highFat: {
    label: "High Fat",
    bgColor: "#F59E0B",
    icon: Droplets,
  },
  lowFat: {
    label: "Low Fat",
    bgColor: "#0D9488",
    icon: Leaf,
  },
  highCalorie: {
    label: "High Calorie",
    bgColor: "#DC2626",
    icon: Flame,
  },
  lowCalorie: {
    label: "Low Calorie",
    bgColor: "#7C3AED",
    icon: Flame,
  },
};

export const NON_NUTRITION_PILLS_CONFIG = {
  energyMeal: {
    label: "Energy Meal",
    bgColor: "#F97316",
    icon: Zap,
  },
  filling: {
    label: "Filling",
    bgColor: "#F59E0B",
    icon: Flame,
  },
  balanced: {
    label: "Balanced",
    bgColor: "#0D9488",
    icon: Scale,
  },
  quick: {
    label: "Quick",
    bgColor: "#2563EB",
    icon: Clock,
  },
};

export const MACRO_RULES = {
  highProtein: (meal: MealPillType) => meal.protein >= 30,
  highCarb: (meal: MealPillType) => meal.carbs >= 45,
  lowCarb: (meal: MealPillType) => meal.carbs <= 20,
  highFat: (meal: MealPillType) => meal.fats >= 25,
  lowFat: (meal: MealPillType) => meal.fats <= 15,
  highCalorie: (meal: MealPillType) => meal.calories >= 550,
  lowCalorie: (meal: MealPillType) => meal.calories <= 350,
};

export const NON_MACRO_RULES = {
  energyMeal: (meal: MealPillType) => meal.calories >= 500 && meal.carbs >= 40,
  filling: (meal: MealPillType) => meal.protein >= 25 && meal.fats >= 20,
  balanced: (meal: MealPillType) => meal.protein >= 20 && meal.carbs >= 30 && meal.fats >= 15,
  quick: (meal: MealPillType) => (meal.total_time ? meal.total_time <= 20 : false),
};
