import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { formatMealPrice } from "@/frontend/core/prices/utils/prices";

/** One thing to buy when starting from an empty pantry. */
export type PriceInfoItem = {
  /** What a shopper calls it ("Soy sauce"). */
  name: string;
  /** What to pick up ("385 ml bottle", "240 g"). */
  buy: string;
  /** ₱ for the whole pack (or the loose amount), rounded to the peso so
   *  the rows add up to the total shown. */
  price: number;
  /** ₱ of it this meal uses. */
  usedPrice: number;
  /** No store listing: the price is an estimate ("~"). */
  estimate?: boolean;
};

/** The meal's two prices at the servings shown when it was opened. */
export type PriceInfo = {
  /** What the dish uses (the meal's own price), and its upper end if it
   *  has a range. */
  cook: number;
  cookBuffer?: number | null;
  /** The part of the whole packs this dish doesn't use, so `cook +
   *  leftover` is the bill when starting from an empty pantry (the sum of
   *  `items`). */
  leftover: number;
  /** Everything to buy from an empty pantry, priciest first. */
  items: PriceInfoItem[];
};

type PriceInfoSheetProps = {
  /** null closes the sheet. */
  info: PriceInfo | null;
  onClose: () => void;
  /** Cap on the sheet's height, as a fraction of the screen. */
  maxHeightPercent: number;
};

// Opened from the meal's price ("Estimated Price ⓘ") or the totals under
// the ingredient list in MealDetailContent: why the meal costs less than
// buying every pack. Reads top to bottom as answer, then proof: the two
// prices in plain words, then the itemised bill that adds up to the
// bigger price. Rendered "inline" in
// MealDetailSheet's overlay slot, like IngredientDetailSheet (two native
// Modals don't stack reliably). fitContent scrolls once a long bill hits
// the height cap.
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

  return (
    <BottomSheet visible={!!info} onClose={onClose} heightPercent={maxHeightPercent} presentation="inline" fitContent>
      {rendered && (
        <View className="gap-5 px-5 pt-6 pb-8">
          <View className="gap-2">
            <AppText variant="sectionTitle" dot>
              How we price this
            </AppText>
            {/* The whole idea in two short sentences, before any number. */}
            <Text className="font-inter-regular text-body text-ink">
              Stores sell whole packs, but a recipe often uses only part of one. So we show two prices.
            </Text>
          </View>

          {/* The two prices, each with one plain line on when it applies. */}
          <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10">
            <View className="flex-row items-start justify-between gap-3 border-b border-ink-emphasis/10 p-4">
              <View className="flex-1 gap-1">
                <Text className="font-inter-bold text-body text-ink-emphasis">Estimated price</Text>
                <Text className="font-inter-regular text-small text-ink-subtle">
                  Only what this recipe uses, like 2 tbsp from a bottle of soy sauce.
                </Text>
              </View>
              <Text className="font-inter-extrabold text-subheading text-primary">{cookLabel}</Text>
            </View>
            <View className="flex-row items-start justify-between gap-3 p-4">
              <View className="flex-1 gap-1">
                <Text className="font-inter-bold text-body text-ink-emphasis">Buying everything new</Text>
                <Text className="font-inter-regular text-small text-ink-subtle">
                  Every pack at full price. {leftoverLabel} of it stays in your pantry for next time.
                </Text>
              </View>
              <Text className="font-inter-extrabold text-subheading text-ink-emphasis">{fullLabel}</Text>
            </View>
          </View>

          {/* The itemised bill: the proof behind "Buying everything new".
              Priciest first, so what drives the total is on top. */}
          {rendered.items.length > 0 && (
            <View className="gap-3">
              <AppText variant="sectionTitle" dot>
                If you buy everything new
              </AppText>
              <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10">
                {rendered.items.map((item, i) => {
                  const partUsed = item.price - item.usedPrice >= 0.5;
                  return (
                    <View
                      key={`${item.name}-${i}`}
                      className={`flex-row items-start justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}
                    >
                      <View className="flex-1">
                        <Text className="font-inter-semibold text-body text-ink-emphasis">{item.name}</Text>
                        <Text className="font-inter-regular text-small text-ink-subtle">{item.buy}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-inter-bold text-body text-ink-emphasis">
                          {item.estimate ? "~" : ""}
                          {formatMealPrice(item.price)}
                        </Text>
                        {/* Only when the pack outlasts the meal: how little of it this meal uses. */}
                        {partUsed && (
                          <Text className="font-inter-regular text-small text-ink-subtle">
                            uses {item.usedPrice < 1 ? "under ₱1" : formatMealPrice(item.usedPrice)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
                <View className="flex-row items-center justify-between gap-3 border-t border-ink-emphasis/10 bg-notice-positive-bg px-4 py-3">
                  <Text className="font-inter-bold text-body text-ink-emphasis">Total</Text>
                  <Text className="font-inter-extrabold text-body text-ink-emphasis">{fullLabel}</Text>
                </View>
              </View>
              {rendered.items.some((item) => item.estimate) && (
                <Text className="font-inter-regular text-small text-ink-subtle">
                  Prices with ~ are estimates for a typical pack.
                </Text>
              )}
            </View>
          )}

          <Button label="Got it" variant="tinted" onPress={onClose} />
        </View>
      )}
    </BottomSheet>
  );
}
