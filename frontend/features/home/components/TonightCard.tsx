import { type ReactNode, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { Bookmark } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { fitsDietaryFocus, matchBudget, parseBudget, type BudgetMatch } from "@/frontend/core/budget/utils/budgetMatch";
import { inCategory, type CategoryId } from "@/frontend/core/budget/utils/categories";
import { MealPhotoTile } from "@/frontend/core/meals/components/card/MealPhotoTile";
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
const HERO_HEIGHT = 190;
const SMALL_HEIGHT = 120;
// After the sheet's close animation, so the card isn't swapped out from
// under it.
const SHEET_CLOSE_MS = 400;
const SAVE_HINT_DELAY_MS = 900;

// What the card is about, by the time of day: lunch until mid afternoon,
// then tonight. In the morning it's the day's ulam (lunch first). Picks
// follow that meal time when enough meals are tagged for it.
type Moment = { title: string; category: CategoryId };
function momentNow(hour = new Date().getHours()): Moment {
  if (hour < 10) return { title: "Today's ulam", category: "lunch" };
  if (hour < 15) return { title: "Lunch", category: "lunch" };
  return { title: "Tonight's ulam", category: "dinner" };
}

/** The best home-cooked matches for the budget, with the same rules as
 *  Suggest by Budget (allergens, ingredients to avoid, dietary focus),
 *  for this meal time when there are enough. */
function usePicks(tonight: TonightBudget, moment: Moment) {
  const { data: meals, isPending } = useRealMeals();
  const { prefs } = usePreferences();
  const { isAvoided } = useAvoidFilter();
  const amount = parseBudget(tonight.budget) ?? 0;
  const picks = useMemo(() => {
    const fits: BudgetMatch[] = matchBudget(meals ?? [], amount, tonight.servings, prefs.allergens).filter(
      (m) => m.meal.category !== "fast_food" && !isAvoided(m.meal) && fitsDietaryFocus(m.meal, prefs.dietary_focus),
    );
    const timed = fits.filter((m) => inCategory(m.meal, moment.category));
    return (timed.length >= PICKS ? timed : fits).slice(0, PICKS);
  }, [meals, amount, tonight.servings, prefs.allergens, prefs.dietary_focus, isAvoided, moment.category]);
  return { picks, amount, loading: isPending };
}

// Home's lead card for someone new, in the plan card's place until their
// first real step (a meal opened, a meal saved, a plan made): the best meals
// for the budget picked in onboarding, one featured and two more, with the
// next step said plainly (open one, save it, it goes on your list). With no
// matches it steps aside for `fallback` (the plan card).
export function TonightCard({ tonight, fallback }: { tonight: TonightBudget; fallback: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [moment] = useState(momentNow);
  const { picks, amount, loading } = usePicks(tonight, moment);
  const [selected, setSelected] = useState<MealType | null>(null);
  const { meal: detailMeal, loading: detailLoading } = useFullMeal(selected);

  if (!loading && picks.length === 0) return <>{fallback}</>;

  const open = (meal: MealType) => {
    const store = useFirstRunStore.getState();
    store.setTonightSheetOpen(true);
    store.markDone();
    setSelected(meal);
    // Once, while they're looking at the meal: what saving does.
    if (!store.saveHintShown) {
      store.markSaveHintShown();
      setTimeout(
        () => showGlobalToast({ tone: "success", message: "Tap the bookmark to save it. Its ingredients go on your grocery list." }),
        SAVE_HINT_DELAY_MS,
      );
    }
  };
  const close = () => {
    setSelected(null);
    setTimeout(() => useFirstRunStore.getState().setTonightSheetOpen(false), SHEET_CLOSE_MS);
  };

  const people = `${tonight.servings} ${tonight.servings === 1 ? "person" : "people"}`;
  const peso = `₱${amount.toLocaleString("en-US")}`;
  const enter = (i: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(i * 80).duration(380).easing(EASE));
  const [hero, ...rest] = picks;
  const tile = (pick: BudgetMatch, size: "large" | "small", height: number, caption?: string) => (
    <MealPhotoTile
      meal={pick.meal}
      size={size}
      height={height}
      stat={`₱${Math.round(pick.cost)}`}
      caption={caption}
      onPress={() => open(pick.meal)}
      accessibilityLabel={`${pick.meal.name}, about ₱${Math.round(pick.cost)} for ${people}. Opens the recipe.`}
    />
  );

  return (
    <View className="rounded-3xl bg-white shadow-sm">
      <View className="overflow-hidden rounded-3xl bg-white px-5 pb-5 pt-5">
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Text className="font-inter-bold text-sub uppercase text-primary">Start here</Text>
        </View>
        <Text className="mt-2 font-inter-extrabold text-heading tracking-display text-ink-emphasis">
          {moment.title} for {peso}
          <Text className="text-accent">.</Text>
        </Text>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
          Picked for your budget, for {people}. Open one to see the recipe and what to buy.
        </Text>

        {loading || !hero ? (
          <View className="mt-4 gap-2">
            <View className="rounded-2xl bg-ink-emphasis/5" style={{ height: HERO_HEIGHT }} />
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-2xl bg-ink-emphasis/5" style={{ height: SMALL_HEIGHT }} />
              <View className="flex-1 rounded-2xl bg-ink-emphasis/5" style={{ height: SMALL_HEIGHT }} />
            </View>
          </View>
        ) : (
          <View className="mt-4 gap-2">
            <Animated.View entering={enter(0)}>{tile(hero, "large", HERO_HEIGHT, `Best match · for ${people}`)}</Animated.View>
            {rest.length > 0 && (
              <View className="flex-row gap-2">
                {rest.map((pick, i) => (
                  <Animated.View key={pick.meal.id ?? pick.meal.name} entering={enter(i + 1)} className="flex-1">
                    {tile(pick, "small", SMALL_HEIGHT)}
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* The step after opening one, said up front. */}
        <View className="mt-4 flex-row items-center gap-2.5 rounded-2xl bg-mood-bg px-3.5 py-3">
          <Bookmark color={colors.primary} size={16} strokeWidth={2.4} />
          <Text className="flex-1 font-inter-regular text-small text-ink">
            Save the one you like. Its ingredients go straight to your grocery list.
          </Text>
        </View>
      </View>

      <MealDetailSheet meal={detailMeal} loading={detailLoading} onClose={close} />
    </View>
  );
}
