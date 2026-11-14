import { memo, useState, useTransition } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { FREE_DAILY_SUGGESTIONS, GUEST_DAILY_SUGGESTIONS, dailyLimitFor } from "@/frontend/core/pro/proContent";
import { useDailyLimit } from "@/frontend/core/pro/dailyLimits";
import { DailyLimitSheet } from "@/frontend/core/pro/components/DailyLimitSheet";
import type { LandingDot } from "@/frontend/components/ui";
import { BudgetForm } from "./BudgetForm";
import { MealSuggestion } from "./MealSuggestion";
import { CategoriesSection } from "./CategoriesSection";
import { PreferencesBanner } from "./PreferencesBanner";
import type { CategoryId } from "../utils/categories";
import { RecommendationsSection } from "./RecommendationsSection";
import { CommunityFavoritesSection } from "./CommunityFavoritesSection";
import { BestValueMealsSection } from "@/frontend/core/meals/components/BestValueMealsSection";

// Everything Budget mode shows on Home, as one unit — HomeScreen just
// renders this or PantrySection depending on the toggle, nothing more.
type BudgetSectionProps = {
  /** Passed to the "Categories." title (see CategoriesSection). */
  categoriesLanding?: LandingDot;
};

function BudgetSectionInner({ categoriesLanding }: BudgetSectionProps) {
  const [suggestion, setSuggestion] = useState<{
    budget: string;
    servings: number;
  } | null>(null);
  // Home's Categories pick (no budget asked): Recommendations shows that
  // category.
  const [homeCategory, setHomeCategory] = useState<CategoryId | null>(null);
  // A category switch re-renders the sections below; as a transition, the
  // tile reacts at once and Recommendations shows skeletons until it's ready.
  const [switchingCategory, startCategorySwitch] = useTransition();
  const pickHomeCategory = (id: CategoryId | null) => startCategorySwitch(() => setHomeCategory(id));
  // Bumped by "Clear budget": remounts the form, emptying its fields.
  const [formRun, setFormRun] = useState(0);
  const clearBudget = () => {
    setSuggestion(null);
    setFormRun((n) => n + 1);
    // Home's Categories row comes back with nothing picked: match it.
    setHomeCategory(null);
  };

  // Suggest by Budget's daily limit (see dailyLimits): a new budget and
  // servings counts once; asking again for the same today is free.
  const isPro = useIsPro();
  const { isSignedIn } = useAuth();
  const daily = useDailyLimit("budget", dailyLimitFor({ isPro, isGuest: !isSignedIn }, GUEST_DAILY_SUGGESTIONS, FREE_DAILY_SUGGESTIONS));
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const beforeSuggest = async ({ budget, servings }: { budget: string; servings: number }) => {
    const ok = await daily.use(JSON.stringify([budget.trim(), servings]));
    if (!ok) setLimitSheetOpen(true);
    return ok;
  };

  return (
    <View className="gap-6 mb-10">
      <BudgetForm key={formRun} onSuggestMeals={setSuggestion} beforeSuggest={beforeSuggest} />

      {suggestion ? (
        // Keyed by the ask, so a new budget or servings starts with the
        // filter chips cleared.
        <MealSuggestion
          key={`${suggestion.budget}|${suggestion.servings}`}
          budget={suggestion.budget}
          servings={suggestion.servings}
          onClear={clearBudget}
        />
      ) : (
        <>
          {/* Only once preferences are set (no prompt here): Recommendations
              below follows them. */}
          <PreferencesBanner onlyWhenSet />
          <CategoriesSection landing={categoriesLanding} onChange={pickHomeCategory} />
          <RecommendationsSection category={homeCategory} switching={switchingCategory} />
          <CommunityFavoritesSection />
          <BestValueMealsSection />
        </>
      )}

      <DailyLimitSheet
      kind="budget"
        visible={limitSheetOpen}
        what="budget suggestions"
        limit={daily.limit}
        onClose={() => setLimitSheetOpen(false)}
        onOpenPro={() => router.push({ pathname: "/pro", params: { source: "limit_sheet" } })}
      />
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const BudgetSection = memo(BudgetSectionInner);
