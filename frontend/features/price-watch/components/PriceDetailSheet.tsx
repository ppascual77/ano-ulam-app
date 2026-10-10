import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { MacroSection } from "@/frontend/core/meals/components/detail/MacroSection";
import { RelatedMealCard } from "@/frontend/core/meals/components/detail/RelatedMealCard";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useMealsForIngredient } from "@/frontend/core/prices/hooks/usePriceMeals";
import { formatPeso, formatShortDate, trendOf, unitLabel, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { priceWatchCategories } from "../constants/categories";
import { MarketsSheet } from "./MarketsSheet";
import { PriceDisclaimer } from "./PriceDisclaimer";
import { PriceTrendChart } from "./PriceTrendChart";
import { TREND_TEXT, TrendIcon } from "./TrendIcon";

const MEALS_PAGE = 4;

type PriceDetailSheetProps = {
  /** null closes the sheet. */
  item: PriceItem | null;
  onClose: () => void;
  onClosed?: () => void;
  onOpenMeal: (meal: MealType) => void;
};

function SectionLabel({ children }: { children: string }) {
  return <AppText variant="eyebrow" className="mb-3">{children}</AppText>;
}

// "Bangus, Large" → "Bangus", "Sardines (Tamban)" → "Sardines".
const baseName = (name: string) => name.split(/[,(]/)[0].trim();

export function PriceDetailSheet({ item, onClose, onClosed, onOpenMeal }: PriceDetailSheetProps) {
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [shownMeals, setShownMeals] = useState(MEALS_PAGE);
  // Keep showing the last item while the sheet slides closed.
  const [shown, setShown] = useState<PriceItem | null>(item);
  useEffect(() => {
    if (item) {
      setShown(item);
      setShownMeals(MEALS_PAGE);
    }
  }, [item]);

  const meals = useMealsForIngredient(shown?.ingredientId ?? null);
  const mealList = meals.data ?? [];

  return (
    <BottomSheet
      visible={!!item}
      onClose={onClose}
      onClosed={onClosed}
      fitContent
      heightPercent={0.85}
      overlay={<MarketsSheet visible={marketsOpen} onClose={() => setMarketsOpen(false)} presentation="inline" />}
    >
      {shown && (
        <View className="gap-5 px-5 pb-8 pt-6">
          <View>
            <AppText variant="eyebrow">
              {priceWatchCategories.find((c) => c.id === shown.category)?.label ?? shown.category}
            </AppText>
            <AppText variant="heading">{shown.name}</AppText>
            {!!shown.specification && <AppText variant="caption">{shown.specification}</AppText>}
          </View>

          <View>
            <View className="flex-row items-start gap-5">
              <View>
                <Text className="font-inter-medium text-subhero text-ink-emphasis">{formatPeso(shown.latestPrice)}</Text>
                <Text className="font-inter-regular text-small text-ink-subtle">{unitLabel(shown)}</Text>
                <Text className="font-inter-regular text-sub text-ink-subtle">As of {formatShortDate(shown.latestDate)}</Text>
              </View>
              {shown.weekAgoPrice != null && (
                <>
                  <View className="mt-1 h-10 w-px bg-ink-emphasis/10" />
                  <View>
                    <Text className="font-inter-medium text-subheading text-ink-subtle">{formatPeso(shown.weekAgoPrice)}</Text>
                    <Text className="font-inter-regular text-sub text-ink-subtle">Last week&apos;s price</Text>
                  </View>
                </>
              )}
            </View>
            {shown.pctChange != null && (
              <View className="mt-2 flex-row items-center gap-1">
                <TrendIcon pct={shown.pctChange} />
                <Text className={`font-inter-bold text-body ${TREND_TEXT[trendOf(shown.pctChange)]}`}>
                  {shown.pctChange === 0
                    ? "Stable vs last week"
                    : `${shown.pctChange > 0 ? "+" : ""}${shown.pctChange}% vs last week`}
                </Text>
              </View>
            )}
          </View>

          <View>
            <SectionLabel>30-day trend</SectionLabel>
            <PriceTrendChart daily={shown.daily} />
          </View>

          {shown.nutrition && (
            <View>
              <SectionLabel>Nutrition</SectionLabel>
              <MacroSection
                calories={shown.nutrition.calories}
                protein={shown.nutrition.protein}
                carbs={shown.nutrition.carbs}
                fats={shown.nutrition.fats}
              />
              <Text className="mt-3 text-right font-inter-regular text-sub text-ink-subtle">
                *per {shown.nutrition.basis}
              </Text>
            </View>
          )}

          {mealList.length > 0 && (
            <View>
              <SectionLabel>{`Meals with ${baseName(shown.name)}`}</SectionLabel>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {mealList.slice(0, shownMeals).map((meal) => (
                  <RelatedMealCard key={meal.id} meal={meal} onPress={() => onOpenMeal(meal)} />
                ))}
              </View>
              {shownMeals < mealList.length && (
                <Pressable onPress={() => setShownMeals((n) => n + MEALS_PAGE)} className="mt-2 self-end" hitSlop={8}>
                  <Text className="font-inter-medium text-small text-primary underline">View more</Text>
                </Pressable>
              )}
            </View>
          )}

          <PriceDisclaimer variant="small" onOpenMarkets={() => setMarketsOpen(true)} />
        </View>
      )}
    </BottomSheet>
  );
}
