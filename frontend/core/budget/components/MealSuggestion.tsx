import { useMemo, useState, useTransition } from "react";
import { useAvoidFilter } from "@/frontend/core/preferences/hooks/useAvoidFilter";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { X, Target } from "lucide-react-native";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { goalDistance } from "@/frontend/core/nutrition/goalFit";
import { colors } from "@/frontend/constants/theme";
import { MealCarouselSection } from "./MealCarouselSection";
import { CategoriesSection } from "./CategoriesSection";
import { CATEGORY_NOUNS, inCategory, type CategoryId } from "../utils/categories";
import { BudgetEmptyState } from "./BudgetEmptyState";
import { PreferencesBanner } from "./PreferencesBanner";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { fitsDietaryFocus, matchBudget, parseBudget } from "../utils/budgetMatch";
import { DIETARY_FOCUS_OPTIONS } from "@/frontend/core/preferences/options";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";

type MealSuggestionProps = {
  /** As typed in the form (BudgetForm only suggests with a real amount). */
  budget: string;
  servings: number;
  /** "Clear budget": back to Home's usual sections, with the form emptied. */
  onClear: () => void;
};

// Rendered on Home once "Suggest Meals" is pressed, replacing the
// Categories/Recommendations/Community Favorites sections: real meals that
// cost about the budget for the chosen servings (see budgetMatch), closest
// first, in Home-cooked and Fast food rows, priced for those servings.
// Quick filter: the Categories row (a meal time, or fast food). See All has
// the macro and protein chips (MealListScreen).
export function MealSuggestion({ budget, servings, onClear }: MealSuggestionProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  // The Categories tile picked (null: all).
  const [category, setCategory] = useState<CategoryId | null>(null);
  // A category switch as a transition: the tile reacts at once, the rows
  // show skeletons until the new ones are ready.
  const [switchingCategory, startCategorySwitch] = useTransition();
  const pickCategory = (id: CategoryId | null) => startCategorySwitch(() => setCategory(id));
  const { data: meals, isPending } = useRealMeals();
  const amount = parseBudget(budget) ?? 0;

  const { prefs: preferences } = usePreferences();
  const allergens = preferences.allergens;
  // Pro: ingredients to avoid are left out like allergens.
  const { isAvoided } = useAvoidFilter();

  // Active preferences, then the picked category, narrow what fits the
  // budget. Allergens are always left out (a safety rule, inside
  // matchBudget); the dietary focus keeps meals tagged for it (looser diets
  // accept stricter ones, see fitsDietaryFocus).
  const inBudget = useMemo(
    () => matchBudget(meals ?? [], amount, servings, allergens).filter((m) => !isAvoided(m.meal)),
    [meals, amount, servings, allergens, isAvoided],
  );
  const focus = preferences.dietary_focus;
  const matches = inBudget.filter((m) => fitsDietaryFocus(m.meal, focus));
  // The picked category: a meal time keeps meals tagged with it (both rows);
  // Fastfood keeps just the fast food row.
  const inView = matches.filter((m) => inCategory(m.meal, category));

  // Empty because of the dietary focus (meals do fit the budget, just not
  // the focus): say so, and offer to change it.
  const focusLabel = DIETARY_FOCUS_OPTIONS.find((o) => o.id === focus)?.label.toLowerCase();
  const focusHidesAll = inBudget.length > 0 && matches.length === 0 && !!focusLabel;
  // Pro with nutrition goals: "Best for my goals" re-orders each row by how
  // close a serving comes to a meal's share of the goals (else closest to
  // the budget, matchBudget's order).
  const goals = useNutritionGoals();
  const [byGoals, setByGoals] = useState(false);
  const ordered = useMemo(() => {
    const meals = inView.map((m) => m.meal);
    if (!byGoals || !goals) return meals;
    return [...meals].sort((a, b) => (goalDistance(a, goals) ?? 0) - (goalDistance(b, goals) ?? 0));
  }, [inView, byGoals, goals]);
  const homeCooked = ordered.filter((meal) => meal.category !== "fast_food");
  const fastFood = ordered.filter((meal) => meal.category === "fast_food");

  const renderCard = (meal: MealType, _index: number, open: () => void) => (
    <MealCard meal={meal} onPress={open} isFastFood={meal.category === "fast_food"} />
  );

  return (
    <View className="gap-5">
      {/* What these results are for, and the way back to Home's usual
          sections. */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={`Clear budget: ₱${amount.toLocaleString("en-US")} for ${servings} ${servings === 1 ? "serving" : "servings"}`}
          hitSlop={6}
          className="flex-row items-center gap-1.5 self-start rounded-full bg-primary py-1.5 pl-3.5 pr-2.5 active:opacity-80"
        >
          <Text className="font-inter-semibold text-small text-white">
            ₱{amount.toLocaleString("en-US")} · {servings} {servings === 1 ? "serving" : "servings"}
          </Text>
          <X color={colors.white} size={14} />
        </Pressable>
        {goals && (
          <Pressable
            onPress={() => setByGoals((on) => !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: byGoals }}
            hitSlop={6}
            className={`flex-row items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-3.5 active:opacity-80 ${
              byGoals ? "border-primary bg-primary/10" : "border-ink-emphasis/15"
            }`}
          >
            <Target color={byGoals ? colors.primary : colors.ink.subtle} size={14} />
            <Text className={`font-inter-semibold text-small ${byGoals ? "text-primary" : "text-ink-subtle"}`}>Best for my goals</Text>
          </Pressable>
        )}
      </View>

      <PreferencesBanner open={preferencesOpen} onOpenChange={setPreferencesOpen} />

      {/* The results' quick filter: the meal-time categories, like Home's.
          Hidden when nothing fits the budget at all, since no category
          could help then. */}
      {(isPending || matches.length > 0) && <CategoriesSection plainTitle onChange={pickCategory} />}

      {isPending || switchingCategory ? (
        <MealCarouselSection title="Home-cooked (Luto)" meals={[]} loading showSeeAll={false} />
      ) : focusHidesAll ? (
        // Meals fit the budget, just none for the dietary focus.
        <BudgetEmptyState
          budget={amount}
          title={`No ${focusLabel} meals fit ₱${amount.toLocaleString("en-US")} yet`}
          body="We're still curating more meals for every budget and diet. For now, try a bigger budget, or change your preferences."
          action={{ label: "Change preferences", onPress: () => setPreferencesOpen(true) }}
        />
      ) : inView.length === 0 ? (
        // Nothing in budget at all, or nothing in the picked category.
        <BudgetEmptyState budget={amount} category={matches.length > 0 && category ? CATEGORY_NOUNS[category] : undefined} />
      ) : (
        <>
          {homeCooked.length > 0 && (
            <MealCarouselSection
              title="Home-cooked (Luto)"
              meals={homeCooked}
              budgetLabel={budget}
              servings={servings}
              renderCard={renderCard}
              pageSize={5}
              capForFree
            />
          )}
          {fastFood.length > 0 && (
            <MealCarouselSection
              title="Fastfood"
              meals={fastFood}
              budgetLabel={budget}
              servings={servings}
              renderCard={renderCard}
              pageSize={5}
              capForFree
            />
          )}
        </>
      )}
    </View>
  );
}
