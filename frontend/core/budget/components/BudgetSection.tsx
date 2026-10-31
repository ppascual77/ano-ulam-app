import { memo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { FREE_DAILY_SUGGESTIONS, GUEST_DAILY_SUGGESTIONS, dailyLimitFor } from "@/frontend/core/pro/proContent";
import { leftHint, useDailyLimit } from "@/frontend/core/pro/dailyLimits";
import { DailyLimitSheet } from "@/frontend/core/pro/components/DailyLimitSheet";
import type { LandingDot } from "@/frontend/components/ui";
import { BudgetForm } from "./BudgetForm";
import { MealSuggestion } from "./MealSuggestion";
import { CategoriesSection } from "./CategoriesSection";
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
      <BudgetForm onSuggestMeals={setSuggestion} beforeSuggest={beforeSuggest} hint={leftHint(daily.left, "suggestion")} />

      {suggestion ? (
        <MealSuggestion budget={suggestion.budget} />
      ) : (
        <>
          <CategoriesSection landing={categoriesLanding} />
          <RecommendationsSection />
          <CommunityFavoritesSection />
          <BestValueMealsSection />
        </>
      )}

      <DailyLimitSheet
        visible={limitSheetOpen}
        what="budget suggestions"
        limit={daily.limit}
        onClose={() => setLimitSheetOpen(false)}
        onOpenPro={() => router.push("/pro")}
      />
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const BudgetSection = memo(BudgetSectionInner);
