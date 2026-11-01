import { useMemo } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/frontend/components/ui";
import { getMeal } from "@/api/meals";
import { RelatedMealCard } from "./RelatedMealCard";
import { usePreferredMeals } from "../../hooks/usePreferredMeals";
import { mealRowToMealType } from "../../utils/mealAdapter";
import type { MealType } from "../../mealTypes";

const LIMIT = 8;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// What's related, the same way the web app's server picks it, on the real
// catalog (following preferences): first, the same category and protein
// ("More pork meals"); else, for a user's recipe, other users' recipes in
// the category; else meals in the category sharing a tag. Up to LIMIT,
// shuffled once per meal opened.
function pickRelated(meal: MealType, pool: MealType[]): { meals: MealType[]; title: string } {
  const others = pool.filter((m) => m.id !== meal.id && m.name !== meal.name && m.category === meal.category);
  if (meal.protein_type) {
    const sameProtein = others.filter((m) => m.protein_type === meal.protein_type);
    if (sameProtein.length > 0) return { meals: shuffle(sameProtein).slice(0, LIMIT), title: `More ${meal.protein_type} meals` };
  }
  if (meal.poster_id) {
    const userPublished = others.filter((m) => m.poster_id);
    if (userPublished.length > 0) return { meals: shuffle(userPublished).slice(0, LIMIT), title: "More user published meals" };
  }
  const tags = new Set(meal.tags ?? []);
  const similar = others.filter((m) => (m.tags ?? []).some((tag) => tags.has(tag)));
  return { meals: shuffle(similar).slice(0, LIMIT), title: "Related meals" };
}

type RelatedMealsProps = {
  meal: MealType;
  onSelectMeal?: (meal: MealType) => void;
};

export function RelatedMeals({ meal, onSelectMeal }: RelatedMealsProps) {
  const { meals: pool } = usePreferredMeals();
  const queryClient = useQueryClient();
  // Re-picked only when another meal is opened (or the catalog changes).
  const { meals: related, title } = useMemo(() => pickRelated(meal, pool), [meal.id, pool]);
  if (related.length === 0) return null;

  // The cards are from the bulk list (no ingredients): open the full meal,
  // so its ingredients and micronutrients show (shares useFullMeal's cache).
  const open = async (picked: MealType) => {
    if (!picked.id) return;
    const row = await queryClient.fetchQuery({ queryKey: ["meals", "full", picked.id], queryFn: () => getMeal(picked.id as string) });
    onSelectMeal?.(mealRowToMealType(row, row.meal_ingredients));
  };

  return (
    <View className="mt-6">
      <AppText variant="title">{title}</AppText>
      <View className="mx-1 mt-3 flex-row flex-wrap gap-3">
        {related.map((m) => (
          <RelatedMealCard key={m.id} meal={m} onPress={() => void open(m)} />
        ))}
      </View>
    </View>
  );
}
