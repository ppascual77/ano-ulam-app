import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { MacroSection } from "@/frontend/core/meals/components/detail/MacroSection";
import { RelatedMealCard } from "@/frontend/core/meals/components/detail/RelatedMealCard";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";
import { useMealsForIngredient } from "@/frontend/core/prices/hooks/usePriceMeals";
import { formatPeso, formatShortDate, trendOf, unitLabel, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { priceWatchCategories } from "../constants/categories";
import { PriceTrendChart } from "./PriceTrendChart";
import { TREND_TEXT, TrendIcon } from "./TrendIcon";

const MEALS_PAGE = 4;

// The opening sequence, like the showreel's price scene, replayed on every
// open:
//   0ms     blocks rise in one after another (STAGGER_MS apart)
//   250ms   the price counts down from last week's to today's
//   ~0.5s   the 30-day line draws itself, then the latest price lands as
//           the accent dot
const STAGGER_MS = 90;
const ENTER_MS = 420;
const COUNT_DELAY_MS = 250;
const COUNT_MS = 900;
const CHART_DELAY_MS = 500;

const enter = (step: number) => FadeInDown.delay(step * STAGGER_MS).duration(ENTER_MS);

// Each block of the sheet sits in its own soft card, so the layout reads
// in clear chunks: price, trend, nutrition.
const CARD = "rounded-3xl border border-ink-emphasis/10 bg-white p-4";

const TREND_BG = { down: "bg-trend-down/10", up: "bg-trend-up/10", flat: "bg-trend-flat/10" } as const;

// "● MEAT": eyebrow label with the accent dot as its bullet.
function DotLabel({ children, className = "" }: { children: string; className?: string }) {
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <View className="h-2 w-2 rounded-full bg-accent" />
      <AppText variant="eyebrow">{children}</AppText>
    </View>
  );
}

// "Bangus, Large" → "Bangus", "Sardines (Tamban)" → "Sardines".
const baseName = (name: string) => name.split(/[,(]/)[0].trim();

type DetailBodyProps = {
  item: PriceItem;
  onOpenMeal: (meal: MealType) => void;
};

// The sheet's content. Keyed per open by PriceDetailSheet, so mounting it
// plays the whole opening sequence again.
function DetailBody({ item, onOpenMeal }: DetailBodyProps) {
  const [shownMeals, setShownMeals] = useState(MEALS_PAGE);
  const meals = useMealsForIngredient(item.ingredientId);
  const mealList = meals.data ?? [];
  const mealsLoading = !!item.ingredientId && meals.isLoading;

  const from = item.weekAgoPrice ?? item.latestPrice;
  const price = useCountTo(from, item.latestPrice, COUNT_DELAY_MS, COUNT_MS);
  // Whole pesos while counting when both ends are whole, so no cents flash by.
  const wholePesos = Number.isInteger(from) && Number.isInteger(item.latestPrice);
  const shownPrice = wholePesos ? Math.round(price) : Math.round(price * 100) / 100;
  const trend = trendOf(item.pctChange);
  const category = priceWatchCategories.find((c) => c.id === item.category)?.label ?? item.category;
  const name = baseName(item.name);

  return (
    <View className="gap-4 px-5 pb-8 pt-6">
      {/* What it is. */}
      <Animated.View entering={enter(0)} className="mb-1">
        {/* Category on the left, how fresh the price is on the right. */}
        <View className="mb-1 flex-row items-center justify-between">
          <DotLabel>{category}</DotLabel>
          <Text className="font-inter-regular text-small text-ink-subtle">
            As of <Text className="font-inter-semibold text-accent">{formatShortDate(item.latestDate)}</Text>
          </Text>
        </View>
        <AppText variant="sectionTitle" dot>
          {item.name}
        </AppText>
        {!!item.specification && <AppText variant="caption">{item.specification}</AppText>}
      </Animated.View>

      {/* What it costs: today's price, then how it moved vs last week. */}
      <Animated.View entering={enter(1)} className={CARD}>
        <DotLabel>Today&apos;s price</DotLabel>
        <View className="mt-2 flex-row items-baseline gap-2">
          {/* Counts down (or up) from last week's price to today's. */}
          <Text className="font-inter-extrabold text-subhero tracking-display text-ink-emphasis">{formatPeso(shownPrice)}</Text>
          <Text className="font-inter-regular text-body text-ink-subtle">{unitLabel(item)}</Text>
        </View>

        {(item.pctChange != null || item.weekAgoPrice != null) && (
          <View className="mt-3 flex-row items-center justify-between border-t border-ink-emphasis/10 pt-3">
            {item.pctChange != null ? (
              <View className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${TREND_BG[trend]}`}>
                <TrendIcon pct={item.pctChange} />
                <Text className={`font-inter-bold text-body ${TREND_TEXT[trend]}`}>
                  {item.pctChange === 0 ? "Stable" : `${item.pctChange > 0 ? "+" : ""}${item.pctChange}%`} vs last week
                </Text>
              </View>
            ) : (
              <View />
            )}
            {item.weekAgoPrice != null && (
              <Text className="font-inter-regular text-small text-ink-subtle">
                Last week <Text className="font-inter-semibold text-ink">{formatPeso(item.weekAgoPrice)}</Text>
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={enter(2)} className={CARD}>
        <DotLabel className="mb-3">30-day trend</DotLabel>
        <PriceTrendChart daily={item.daily} drawDelay={CHART_DELAY_MS} />
      </Animated.View>

      {item.nutrition && (
        <Animated.View entering={enter(3)} className={CARD}>
          <View className="mb-3 flex-row items-center justify-between">
            <DotLabel>Nutrition</DotLabel>
            <Text className="font-inter-regular text-small text-ink-subtle">per {item.nutrition.basis}</Text>
          </View>
          <MacroSection
            calories={item.nutrition.calories}
            protein={item.nutrition.protein}
            carbs={item.nutrition.carbs}
            fats={item.nutrition.fats}
          />
        </Animated.View>
      )}

      {/* Last: what to make with it, same cards as Meal Details' related
          meals. Always shown, so it never just disappears while loading. */}
      <Animated.View entering={enter(4)} className="mt-4">
        <AppText variant="sectionTitle" dot>
          {`What to cook with ${name}`}
        </AppText>
        <AppText variant="caption" className="mb-3">
          Recipes that use it, so you know what to buy it for.
        </AppText>

        {mealsLoading ? (
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <View key={i} style={{ width: "48%", height: 170 }} className="rounded-xl bg-ink-emphasis/5" />
            ))}
          </View>
        ) : mealList.length === 0 ? (
          <Text className="font-inter-regular text-body text-ink-subtle">No recipes with {name.toLowerCase()} yet.</Text>
        ) : (
          <>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {mealList.slice(0, shownMeals).map((meal, i) => (
                // Cards pop in one by one, also as "View more" adds a page.
                <Animated.View
                  key={meal.id}
                  entering={FadeInDown.delay((i % MEALS_PAGE) * 70).duration(360)}
                  style={{ width: "48%" }}
                >
                  <RelatedMealCard meal={meal} width="100%" onPress={() => onOpenMeal(meal)} />
                </Animated.View>
              ))}
            </View>
            {shownMeals < mealList.length && (
              <Pressable onPress={() => setShownMeals((n) => n + MEALS_PAGE)} className="mt-3 self-center" hitSlop={8}>
                <Text className="font-inter-semibold text-body text-primary">View more</Text>
              </Pressable>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

type PriceDetailSheetProps = {
  /** null closes the sheet. */
  item: PriceItem | null;
  onClose: () => void;
  onClosed?: () => void;
  onOpenMeal: (meal: MealType) => void;
};

export function PriceDetailSheet({ item, onClose, onClosed, onOpenMeal }: PriceDetailSheetProps) {
  // Keep showing the last item while the sheet slides closed.
  const [shown, setShown] = useState<PriceItem | null>(item);
  // Bumped on every open, so reopening even the same item replays the
  // opening sequence (DetailBody is keyed by it).
  const [openCount, setOpenCount] = useState(0);
  useEffect(() => {
    if (item) {
      setShown(item);
      setOpenCount((n) => n + 1);
    }
  }, [item]);

  return (
    <BottomSheet
      visible={!!item}
      onClose={onClose}
      onClosed={onClosed}
      fitContent
      heightPercent={0.85}
    >
      {shown && (
        <DetailBody
          key={`${shown.id}-${openCount}`}
          item={shown}
          onOpenMeal={onOpenMeal}
        />
      )}
    </BottomSheet>
  );
}
