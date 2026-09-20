import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCarouselSection } from "./MealCarouselSection";
import { QuickFilters } from "./QuickFilters";
import { PreferencesSheet } from "./PreferencesSheet";
import { ActivePreferencesSummary } from "./ActivePreferencesSummary";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import { MACRO_RULES, NON_MACRO_RULES } from "@/frontend/core/meals/utils/constants";
import { parseUserPreferences } from "@/api/auth";
import { useUserProfile, useUpdateUserProfile } from "@/frontend/features/auth/hooks/useUserProfile";

type MealSuggestionProps = {
  budget?: string;
};

// Rendered on Home once "Suggest Meals" is pressed, replacing the
// Categories/Recommendations/Community Favorites sections.
export function MealSuggestion({ budget }: MealSuggestionProps) {
  const [filters, setFilters] = useState<string[]>([]);
  const [showBudgetChip, setShowBudgetChip] = useState(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const { data: profile } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const preferences = parseUserPreferences(profile?.preferences);
  const dietaryFocus = preferences.dietary_focus !== "none" ? [preferences.dietary_focus] : [];
  const allergens = preferences.allergens;
  const hasPreferences = dietaryFocus.length > 0 || allergens.length > 0;

  const handleDietaryFocusChange = (value: string[]) => {
    updateProfile.mutate({ preferences: { ...preferences, dietary_focus: value[0] ?? "none" } });
  };

  const handleAllergensChange = (value: string[]) => {
    updateProfile.mutate({ preferences: { ...preferences, allergens: value } });
  };

  const filteredMeals = useMemo(() => {
    if (filters.length === 0) return mockMeals;
    return mockMeals.filter((meal) =>
      filters.every((filterId) => {
        if (filterId === "highProtein") return MACRO_RULES.highProtein(meal);
        if (filterId === "lowCarb") return MACRO_RULES.lowCarb(meal);
        if (filterId === "quick") return NON_MACRO_RULES.quick(meal);
        return meal.protein_type === filterId;
      }),
    );
  }, [filters]);

  const homeCooked = filteredMeals.filter((m) => m.category === "luto");
  const fastFood = filteredMeals.filter((m) => m.category === "fast_food");

  return (
    <View className="gap-5">
      {hasPreferences ? (
        <ActivePreferencesSummary
          dietaryFocus={dietaryFocus}
          allergens={allergens}
          onManage={() => setPreferencesOpen(true)}
        />
      ) : (
        <NoticeBanner icon={<Sparkles color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            Personalize your meal suggestions.{" "}
            <Text onPress={() => setPreferencesOpen(true)} className="font-inter-semibold text-primary">
              Set preferences
            </Text>
          </AppText>
        </NoticeBanner>
      )}

      <QuickFilters
        budgetLabel={showBudgetChip ? budget : undefined}
        onClearBudget={() => setShowBudgetChip(false)}
        selected={filters}
        onChange={setFilters}
      />

      {homeCooked.length > 0 && (
        <MealCarouselSection title="Home-cooked (Luto)" meals={homeCooked} budgetLabel={budget} />
      )}
      {fastFood.length > 0 && <MealCarouselSection title="Fastfood" meals={fastFood} budgetLabel={budget} />}

      <PreferencesSheet
        visible={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        dietaryFocus={dietaryFocus}
        onDietaryFocusChange={handleDietaryFocusChange}
        allergens={allergens}
        onAllergensChange={handleAllergensChange}
      />
    </View>
  );
}
