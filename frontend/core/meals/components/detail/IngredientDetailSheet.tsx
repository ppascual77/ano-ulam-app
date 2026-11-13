import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { capitalize } from "../../utils/dietary";
import { MicronutrientSection, NutritionSection, SourcesSection } from "./IngredientDetailSections";
import { riseIn, useCountUp } from "./sheetMotion";
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
  /** A free user tapping locked micronutrients: open the Pro upsell. */
  onLockedPro?: () => void;
};

/** "₱20" counting up from ₱0 as the sheet opens, with the centavos smaller
 *  and fixed beside it. */
function EstimatedCost({ price }: { price: number }) {
  const [whole, cents] = price.toFixed(2).split(".");
  const shown = useCountUp(Number(whole), 160, 420);
  return (
    <View className="items-end">
      <Text className="font-inter-extrabold text-heading tracking-display text-primary">
        ₱{shown}
        <Text className="text-subheading tracking-normal">.{cents}</Text>
      </Text>
      <Text className="mt-1.5 font-inter-semibold text-sub uppercase tracking-wide text-ink-subtle">Est. cost</Text>
    </View>
  );
}

// Opened by tapping an ingredient card in MealDetailContent. Always rendered
// "inline" inside MealDetailSheet's own overlay slot: it sits on top of an
// already-open sheet, and two native Modals don't stack reliably (see
// BottomSheet's `overlay` / `presentation` docs).
export function IngredientDetailSheet({ ingredient, onClose, maxHeightPercent, onLockedPro }: IngredientDetailSheetProps) {
  // Keep the last ingredient rendered while the sheet animates closed, so
  // it doesn't go blank before it's off-screen (same as MealDetailSheet).
  // `opens` keys the content, so every open remounts it and replays the
  // open choreography (see sheetMotion.ts).
  const [rendered, setRendered] = useState(ingredient);
  const [opens, setOpens] = useState(0);
  useEffect(() => {
    if (ingredient) {
      setRendered(ingredient);
      setOpens((n) => n + 1);
    }
  }, [ingredient]);

  const isMain = rendered?.type === "main";
  const hasPrice = rendered?.price != null && rendered.price > 0;

  return (
    // fitContent: only as tall as this ingredient's sections need (a pantry
    // item with no price is much shorter), capped at maxHeightPercent.
    <BottomSheet
      visible={!!ingredient}
      onClose={onClose}
      heightPercent={maxHeightPercent}
      presentation="inline"
      fitContent
    >
      {rendered && (
        <View key={opens} className="px-5 pt-6 pb-8">
          {/* Role pill, then the name with the amount under it on the left
              and the estimated cost as the one big figure on the right
              (top-aligned, so a wrapped name keeps it on its first line). */}
          <Animated.View entering={riseIn(0)}>
            <View className="flex-row">
              <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${isMain ? "bg-primary/10" : "bg-ink-emphasis/5"}`}>
                <View className={`h-1.5 w-1.5 rounded-full ${isMain ? "bg-primary" : "bg-ink-subtle"}`} />
                <Text className={`font-inter-semibold text-small ${isMain ? "text-primary" : "text-ink-subtle"}`}>
                  {isMain ? "Main ingredient" : "Pantry staple"}
                </Text>
              </View>
            </View>

            <View className="mt-3 flex-row items-start gap-4">
              <View className="flex-1">
                <AppText variant="sectionTitle" dot>
                  {capitalize(rendered.name)}
                </AppText>
                {/* Amount used, then the conversion behind it (e.g. "150g
                    per piece") after a centered dot. */}
                <Text className="mt-1.5 font-inter-regular text-body text-ink">
                  {rendered.qty}
                  {rendered.bridgeLabel && <Text className="text-ink-subtle">{`  ·  ${rendered.bridgeLabel}`}</Text>}
                </Text>
              </View>
              {hasPrice && <EstimatedCost price={rendered.price!} />}
            </View>
          </Animated.View>

          <NutritionSection item={rendered} />
          <MicronutrientSection item={rendered} onLockedPro={onLockedPro} />
          <SourcesSection item={rendered} />
        </View>
      )}
    </BottomSheet>
  );
}
