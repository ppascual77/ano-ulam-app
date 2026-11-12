import { useMemo } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, Keyframe } from "react-native-reanimated";
import { Flag, ShieldAlert } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import type { RecipeDraft } from "../types";
import { draftToMeal } from "../utils/draftToMeal";
import { StepHeader } from "./StepHeader";

// The card rises in with a small scale-up on a calm ease (no spring).
const CARD_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(380);

type ReviewStepProps = {
  draft: RecipeDraft;
  /** "See full details" on the card: the full preview sheet. */
  onViewDetails: () => void;
  reduceMotion: boolean;
};

// Step 4: the recipe as a meal card, the way others will see it in lists
// (built with draftToMeal, so it matches real meal cards), "See full
// details" for the whole meal page, then anything we'll match during review
// and the community guidelines note. The screen renders Submit.
export function ReviewStep({ draft, onViewDetails, reduceMotion }: ReviewStepProps) {
  const card = useMemo(() => draftToMeal(draft), [draft]);
  const flagged = draft.ingredients.filter((i) => !i.ingredient);

  return (
    <View className="gap-6">
      <StepHeader title="Ready to share" subtitle="This is how it will look to others. Tap the card for the full page." />

      <Animated.View entering={reduceMotion ? FadeIn.duration(200) : CARD_IN} className="items-center">
        <MealCard meal={card} onPress={onViewDetails} showDescription onViewDetails={onViewDetails} />
      </Animated.View>

      {flagged.length > 0 && (
        <NoticeBanner icon={<Flag color={colors.notice.icon} size={15} />}>
          <AppText variant="caption" className="text-notice-text">
            {flagged.length} ingredient{flagged.length === 1 ? " isn't" : "s aren't"} in our list yet (
            {flagged.map((i) => i.name).join(", ")}). We&apos;ll match {flagged.length === 1 ? "it" : "them"} during review,
            so the final price and nutrition may change a little.
          </AppText>
        </NoticeBanner>
      )}

      <NoticeBanner icon={<ShieldAlert color={colors.notice.icon} size={16} />}>
        <AppText variant="caption" className="text-notice-text">
          Our team reviews every recipe before it goes live. Recipes that are invalid, not meal-related, or
          inappropriate won&apos;t be published. Help keep the AnoUlam catalog clean and useful for everyone.
        </AppText>
      </NoticeBanner>
    </View>
  );
}
