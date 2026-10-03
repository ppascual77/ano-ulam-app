import { useMemo } from "react";
import { View } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import type { RecipeDraft } from "../types";
import { draftToMeal } from "../utils/draftToMeal";

type PublishStepProps = {
  draft: RecipeDraft;
  /** "View Details" on the card: back to the Preview step (its full details). */
  onViewDetails: () => void;
};

// Step 5: the recipe as a meal card, the way others will see it in lists,
// plus the community guidelines note. Built with the same draftToMeal as
// the Preview step, so the card matches real meal cards (whole-recipe
// totals). The screen renders the Submit button.
export function PublishStep({ draft, onViewDetails }: PublishStepProps) {
  const card = useMemo(() => draftToMeal(draft), [draft]);

  return (
    <View className="gap-6">
      <View>
        <AppText variant="title">Your recipe is ready!</AppText>
        <AppText variant="caption">Here's a preview of how it'll appear to others.</AppText>
      </View>

      <View className="items-center">
        <MealCard meal={card} onPress={onViewDetails} showDescription onViewDetails={onViewDetails} />
      </View>

      <NoticeBanner icon={<ShieldAlert color={colors.notice.icon} size={16} />}>
        <AppText variant="caption" className="text-notice-text">
          Your recipe will be published publicly. Admins may remove recipes that are deemed invalid, non-meal related,
          or inappropriate. Help keep the AnoUlam catalog clean and useful for everyone.
        </AppText>
      </NoticeBanner>
    </View>
  );
}
