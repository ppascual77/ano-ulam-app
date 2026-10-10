import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { ingredientCategoryIcon } from "../../ingredientCategory";
import { capitalize } from "../../utils/dietary";
import { MicronutrientSection, NutritionSection, NutritionSourceSection, PriceSourceSection, hasNutrition } from "./IngredientDetailSections";
import type { IngredientType } from "../../mealTypes";

type IngredientDetailSheetProps = {
  /** Already scaled to the meal's current servings by the caller (qty,
   *  price, macros), so this sheet never re-applies the servings math.
   *  null closes the sheet. */
  ingredient: IngredientType | null;
  onClose: () => void;
  /** Cap on the sheet's height, as a fraction of the screen. It sizes to its
   *  content below that and scrolls above it. MealDetailSheet sets this
   *  relative to its own height. */
  maxHeightPercent: number;
};

// Opened by tapping an ingredient card in MealDetailContent. Always rendered
// "inline" inside MealDetailSheet's own overlay slot: it sits on top of an
// already-open sheet, and two native Modals don't stack reliably (see
// BottomSheet's `overlay` / `presentation` docs).
export function IngredientDetailSheet({ ingredient, onClose, maxHeightPercent }: IngredientDetailSheetProps) {
  // Keep the last ingredient rendered while the sheet animates closed, so
  // it doesn't go blank before it's off-screen (same as MealDetailSheet).
  const [rendered, setRendered] = useState(ingredient);
  useEffect(() => {
    if (ingredient) setRendered(ingredient);
  }, [ingredient]);

  const isMain = rendered?.type === "main";
  const hasPrice = rendered?.price != null && rendered.price > 0;

  return (
    // fitContent: only as tall as this ingredient's sections need (a pantry
    // item with no price section is much shorter), capped at maxHeightPercent.
    <BottomSheet
      visible={!!ingredient}
      onClose={onClose}
      heightPercent={maxHeightPercent}
      presentation="inline"
      fitContent
    >
      {rendered && (
        <View className="px-5 pt-8 pb-8">
          {/* Category icon on the left, centered on the two lines beside it:
              name with price (same heading size, top-aligned so a wrapped
              name keeps the price on its first line), then quantity + pill
              with "Estimated cost". */}
          <View className="flex-row items-center gap-3">
            <Image source={ingredientCategoryIcon(rendered)} style={{ width: 48, height: 48 }} contentFit="contain" />
            <View className="flex-1 gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <AppText variant="sectionTitle" dot className="flex-1">
                  {capitalize(rendered.name)}
                </AppText>
                {hasPrice && <Text className="font-inter-bold text-heading text-primary">~₱{rendered.price!.toFixed(2)}</Text>}
              </View>
              <View className="flex-row items-center justify-between gap-3">
                {/* Amount used (then the conversion behind it, e.g. "150g per
                    piece", after a centered dot), with the Main / Pantry pill
                    beside it. */}
                <View className="flex-1 flex-row flex-wrap items-center gap-2">
                  <Text className="font-inter-regular text-body text-ink">
                    {rendered.qty}
                    {rendered.bridgeLabel && <Text className="text-ink-subtle">{`  ·  ${rendered.bridgeLabel}`}</Text>}
                  </Text>
                  <View className={`rounded-full px-2.5 py-1 ${isMain ? "bg-primary/10" : "bg-ink-emphasis/5"}`}>
                    <Text className={`font-inter-semibold text-small ${isMain ? "text-primary" : "text-ink-subtle"}`}>
                      {isMain ? "Main" : "Pantry"}
                    </Text>
                  </View>
                </View>
                {hasPrice && <Text className="font-inter-regular text-small text-ink-subtle">Estimated cost</Text>}
              </View>
            </View>
          </View>

          <NutritionSection item={rendered} />
          <MicronutrientSection item={rendered} />
          {hasNutrition(rendered) && <NutritionSourceSection item={rendered} />}
          <PriceSourceSection item={rendered} />
        </View>
      )}
    </BottomSheet>
  );
}
