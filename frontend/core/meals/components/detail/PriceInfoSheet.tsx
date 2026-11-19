import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { formatMealPrice } from "@/frontend/core/prices/utils/prices";

/** The meal's two prices at the servings shown when it was opened. */
export type PriceInfo = {
  /** What the dish uses (the meal's own price), and its upper end if it
   *  has a range. */
  cook: number;
  cookBuffer?: number | null;
  /** The part of the whole packs this dish doesn't use, so `cook +
   *  leftover` is the bill when starting from an empty pantry. */
  leftover: number;
};

type PriceInfoSheetProps = {
  /** null closes the sheet. */
  info: PriceInfo | null;
  onClose: () => void;
  /** Cap on the sheet's height, as a fraction of the screen. */
  maxHeightPercent: number;
};

// Opened from the meal's price ("Cost to cook ⓘ") or the "Starting from an
// empty pantry?" row in MealDetailContent: why the meal costs less than
// buying every pack. Rendered "inline" in MealDetailSheet's overlay slot,
// like IngredientDetailSheet (two native Modals don't stack reliably).
export function PriceInfoSheet({ info, onClose, maxHeightPercent }: PriceInfoSheetProps) {
  // Keep the last numbers while the sheet animates closed.
  const [rendered, setRendered] = useState(info);
  useEffect(() => {
    if (info) setRendered(info);
  }, [info]);

  const cookLabel = rendered ? formatMealPrice(rendered.cook, rendered.cookBuffer) : "";
  const fullLabel = rendered
    ? formatMealPrice(rendered.cook + rendered.leftover, rendered.cookBuffer ? rendered.cookBuffer + rendered.leftover : null)
    : "";
  const leftoverLabel = rendered ? formatMealPrice(rendered.leftover) : "";
  // Share of the whole packs this cook uses, for the bar.
  const usedShare = rendered && rendered.cook + rendered.leftover > 0 ? rendered.cook / (rendered.cook + rendered.leftover) : 1;

  return (
    <BottomSheet visible={!!info} onClose={onClose} heightPercent={maxHeightPercent} presentation="inline" fitContent>
      {rendered && (
        <View className="gap-5 px-5 pt-6 pb-8">
          <AppText variant="sectionTitle" dot>
            How we price this meal
          </AppText>

          {/* Used this cook vs left over in the packs. */}
          <View className="gap-2">
            <View
              className="h-3.5 flex-row overflow-hidden rounded-full bg-tinted-bg"
              accessible
              accessibilityLabel={`${cookLabel} used this cook, ${leftoverLabel} left in your pantry`}
            >
              <View className="bg-primary" style={{ width: `${Math.round(usedShare * 100)}%` }} />
            </View>
            <View className="flex-row justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className="h-2.5 w-2.5 rounded-sm bg-primary" />
                <Text className="font-inter-regular text-small text-ink">Used this cook</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="h-2.5 w-2.5 rounded-sm border border-primary/30 bg-tinted-bg" />
                <Text className="font-inter-regular text-small text-ink">Left in your pantry</Text>
              </View>
            </View>
          </View>

          <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10">
            <View className="flex-row justify-between gap-3 border-b border-ink-emphasis/10 p-4">
              <View className="flex-1 gap-1">
                <Text className="font-inter-bold text-body text-ink-emphasis">Cost to cook</Text>
                <Text className="font-inter-regular text-small text-ink-subtle">
                  The share of each ingredient this recipe uses. What the dish really costs once your pantry is stocked.
                </Text>
              </View>
              <Text className="font-inter-extrabold text-subheading text-primary">{cookLabel}</Text>
            </View>
            <View className="flex-row justify-between gap-3 p-4">
              <View className="flex-1 gap-1">
                <Text className="font-inter-bold text-body text-ink-emphasis">Starting from an empty pantry</Text>
                <Text className="font-inter-regular text-small text-ink-subtle">
                  Every pack bought new, as priced on your grocery list. {leftoverLabel} of it lasts beyond this meal.
                </Text>
              </View>
              <Text className="font-inter-extrabold text-subheading text-ink-emphasis">{fullLabel}</Text>
            </View>
          </View>

          <Button label="Got it" variant="tinted" onPress={onClose} />
        </View>
      )}
    </BottomSheet>
  );
}
