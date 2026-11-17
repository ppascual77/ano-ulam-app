import { type ReactNode, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { Text } from "@/frontend/components/ui/Text";
import { showGlobalToast } from "@/frontend/components/ui";
import { fitsDietaryFocus, matchBudget, parseBudget } from "@/frontend/core/budget/utils/budgetMatch";
import { MealPhotoTile, mealPriceLabel } from "@/frontend/core/meals/components/card/MealPhotoTile";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAvoidFilter } from "@/frontend/core/preferences/hooks/useAvoidFilter";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useFirstRunStore, type TonightBudget } from "@/frontend/core/preferences/store/useFirstRunStore";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const EASE = Easing.out(Easing.cubic);
const PICKS = 3;
const TILE_HEIGHT = 150;
// After the sheet's close animation, so the card isn't swapped out from
// under it.
const SHEET_CLOSE_MS = 400;
const SAVE_HINT_DELAY_MS = 900;

/** The best home-cooked matches for tonight's budget, with the same rules
 *  as Suggest by Budget (allergens, ingredients to avoid, dietary focus). */
function useTonightPicks(tonight: TonightBudget) {
  const { data: meals, isPending } = useRealMeals();
  const { prefs } = usePreferences();
  const { isAvoided } = useAvoidFilter();
  const amount = parseBudget(tonight.budget) ?? 0;
  const picks = useMemo(
    () =>
      matchBudget(meals ?? [], amount, tonight.servings, prefs.allergens)
        .filter((m) => m.meal.category !== "fast_food" && !isAvoided(m.meal) && fitsDietaryFocus(m.meal, prefs.dietary_focus))
        .slice(0, PICKS),
    [meals, amount, tonight.servings, prefs.allergens, prefs.dietary_focus, isAvoided],
  );
  return { picks, amount, loading: isPending };
}

// Home's lead card for someone new, in the plan card's place until their
// first real step (a meal opened, a meal saved, a plan made): tonight's
// three best meals for the budget picked at the end of onboarding. One
// clear thing to tap instead of a menu of choices. With no matches it
// steps aside for `fallback` (the plan card).
export function TonightCard({ tonight, fallback }: { tonight: TonightBudget; fallback: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const { picks, amount, loading } = useTonightPicks(tonight);
  const [selected, setSelected] = useState<MealType | null>(null);
  const { meal: detailMeal, loading: detailLoading } = useFullMeal(selected);

  if (!loading && picks.length === 0) return <>{fallback}</>;

  const open = (meal: MealType) => {
    const store = useFirstRunStore.getState();
    store.setTonightSheetOpen(true);
    store.markDone();
    setSelected(meal);
    // Once: what saving does, while they're looking at the meal.
    if (!store.saveHintShown) {
      store.markSaveHintShown();
      setTimeout(() => showGlobalToast({ tone: "success", message: "Like it? Save it and its ingredients go on your grocery list." }), SAVE_HINT_DELAY_MS);
    }
  };
  const close = () => {
    setSelected(null);
    setTimeout(() => useFirstRunStore.getState().setTonightSheetOpen(false), SHEET_CLOSE_MS);
  };

  const people = `${tonight.servings} ${tonight.servings === 1 ? "person" : "people"}`;
  return (
    <View className="rounded-3xl bg-white shadow-sm">
      <View className="overflow-hidden rounded-3xl bg-white px-5 pb-5 pt-5">
        <Text className="font-inter-bold text-sub uppercase text-primary">Start here</Text>
        <Text className="mt-2 font-inter-extrabold text-heading tracking-display text-ink-emphasis">
          Tonight&apos;s ulam for about ₱{amount.toLocaleString("en-US")}
          <Text className="text-accent">.</Text>
        </Text>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">For {people}. Tap one to see how it&apos;s cooked.</Text>

        <View className="mt-4 flex-row gap-2">
          {loading
            ? Array.from({ length: PICKS }, (_, i) => (
                <View key={i} className="flex-1 rounded-2xl bg-ink-emphasis/5" style={{ height: TILE_HEIGHT }} />
              ))
            : picks.map(({ meal, cost }, i) => (
                <Animated.View
                  key={meal.id ?? meal.name}
                  className="flex-1"
                  entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(i * 70).duration(360).easing(EASE)}
                >
                  <MealPhotoTile
                    meal={meal}
                    size="small"
                    height={TILE_HEIGHT}
                    stat={`₱${Math.round(cost)}`}
                    onPress={() => open(meal)}
                    accessibilityLabel={`${meal.name}, about ₱${Math.round(cost)} for ${people}. ${mealPriceLabel(meal)}`}
                  />
                </Animated.View>
              ))}
        </View>
      </View>

      <MealDetailSheet meal={detailMeal} loading={detailLoading} onClose={close} />
    </View>
  );
}
