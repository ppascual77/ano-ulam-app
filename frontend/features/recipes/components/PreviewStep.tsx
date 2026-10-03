import { useMemo } from "react";
import { Text, View } from "react-native";
import { Flag } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailContent } from "@/frontend/core/meals/components/detail/MealDetailContent";
import type { IngredientType } from "@/frontend/core/meals/mealTypes";
import type { RecipeDraft } from "../types";
import { draftToMeal } from "../utils/draftToMeal";

type PreviewStepProps = {
  draft: RecipeDraft;
  /** Tapping an ingredient, same as in the real meal details. */
  onSelectIngredient: (ingredient: IngredientType) => void;
};

// Step 4: the recipe rendered with the real meal details component, inside
// a dashed "draft" frame, scrolling with the rest of the form. Everything
// works as it will once published (servings, tappable ingredients), minus
// the Save button.
export function PreviewStep({ draft, onSelectIngredient }: PreviewStepProps) {
  const meal = useMemo(() => draftToMeal(draft), [draft]);
  const flagged = draft.ingredients.filter((i) => !i.ingredient);

  return (
    <View className="gap-3">
      <View>
        <View className="flex-row items-center gap-2">
          <AppText variant="title">Preview</AppText>
          <View className="rounded-md bg-primary px-2.5 py-1">
            <Text className="font-inter-bold text-small uppercase tracking-wide text-white">Draft</Text>
          </View>
        </View>
        <AppText variant="caption">Here's how your recipe will look when published.</AppText>
      </View>

      {flagged.length > 0 && (
        <NoticeBanner icon={<Flag color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            {flagged.length} ingredient{flagged.length === 1 ? " isn't" : "s aren't"} in our list yet (
            {flagged.map((i) => i.name).join(", ")}). We'll match {flagged.length === 1 ? "it" : "them"} during review,
            so the final price and nutrition may change a little.
          </AppText>
        </NoticeBanner>
      )}

      <View className="overflow-hidden rounded-2xl border border-dashed border-ink-emphasis/30">
        <MealDetailContent meal={meal} preview onSelectIngredient={onSelectIngredient} />
      </View>
    </View>
  );
}
