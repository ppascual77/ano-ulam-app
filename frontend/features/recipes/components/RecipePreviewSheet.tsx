import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { MealDetailContent } from "@/frontend/core/meals/components/detail/MealDetailContent";
import { IngredientDetailSheet } from "@/frontend/core/meals/components/detail/IngredientDetailSheet";
import type { IngredientType } from "@/frontend/core/meals/mealTypes";
import type { RecipeDraft } from "../types";
import { draftToMeal } from "../utils/draftToMeal";

// "See full details" from the Review step: the recipe in the real meal
// details component, everything working as it will once published
// (servings, tappable ingredients), minus the Save button. The ingredient
// sheet opens inline on top (two native Modals don't stack).
export function RecipePreviewSheet({ draft, visible, onClose }: { draft: RecipeDraft; visible: boolean; onClose: () => void }) {
  const meal = useMemo(() => draftToMeal(draft), [draft]);
  const [ingredient, setIngredient] = useState<IngredientType | null>(null);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.92}
      overlay={<IngredientDetailSheet ingredient={ingredient} onClose={() => setIngredient(null)} maxHeightPercent={0.6} />}
    >
      <ScrollView contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-2 px-5 pb-3 pt-2">
          <AppText variant="title">Preview</AppText>
          <View className="rounded-md bg-primary px-2.5 py-1">
            <Text className="font-inter-bold text-small uppercase tracking-wide text-white">Draft</Text>
          </View>
        </View>
        <MealDetailContent meal={meal} preview onSelectIngredient={setIngredient} />
      </ScrollView>
    </BottomSheet>
  );
}
