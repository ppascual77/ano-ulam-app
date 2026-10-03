import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { BottomSheet } from "@/frontend/components/ui";
import { capitalize } from "../../utils/dietary";
import { NutritionSection, NutritionSourceSection, PriceSourceSection, hasNutrition } from "./IngredientDetailSections";
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
  const hasPrice = isMain && rendered?.price != null && rendered.price > 0;

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
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1 items-start gap-2">
              <View className={`rounded-full px-2.5 py-1 ${isMain ? "bg-primary/10" : "bg-ink-emphasis/5"}`}>
                <Text className={`font-inter-semibold text-small ${isMain ? "text-primary" : "text-ink-subtle"}`}>
                  {isMain ? "Main" : "Pantry"}
                </Text>
              </View>
              <Text className="font-inter-bold text-heading text-ink-emphasis">{capitalize(rendered.name)}</Text>
              {/* Amount used, then the conversion behind it (e.g. "150g per
                  piece"), separated by a centered dot. */}
              <Text className="font-inter-regular text-body text-ink">
                {rendered.qty}
                {rendered.bridgeLabel && <Text className="text-ink-subtle">{`  ·  ${rendered.bridgeLabel}`}</Text>}
              </Text>
            </View>

            {hasPrice && (
              <View className="items-end gap-1">
                <Text className="font-inter-regular text-small text-ink-subtle">Estimated cost</Text>
                <Text className="font-inter-bold text-heading text-primary">~₱{rendered.price!.toFixed(2)}</Text>
              </View>
            )}
          </View>

          <NutritionSection item={rendered} />
          {hasNutrition(rendered) && <NutritionSourceSection item={rendered} />}
          {/* Pantry items aren't counted in the meal's price, so they have no
              price to source. */}
          {isMain && <PriceSourceSection item={rendered} />}
        </View>
      )}
    </BottomSheet>
  );
}
