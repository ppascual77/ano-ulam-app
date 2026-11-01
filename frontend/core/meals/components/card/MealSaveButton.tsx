import { Pressable, Text, View } from "react-native";
import { Bookmark } from "lucide-react-native";
import { Confetti, SoftShade, useBurstOnActivate } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useLiveSaveCount } from "@/frontend/core/meals/hooks/useLiveSaveCount";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";

type MealSaveButtonProps = {
  meal: MealType;
  /** Replaces the default save/unsave toggle (a guest's login gate,
   *  Profile's "Remove this meal?"). Saved state still comes from the
   *  shared saved list. */
  onPress?: () => void;
  /** Just the count, no button (someone else's saved list). */
  hideButton?: boolean;
};

// A meal photo's bookmark with how many people saved it under it (its
// popularity), on one faint round shade so both read on light photos
// without a hard edge. Shared by the meal cards.
export function MealSaveButton({ meal, onPress, hideButton = false }: MealSaveButtonProps) {
  const saved = useSavedMealActions();
  const isSaved = !!saved.savedFor(meal);
  // Confetti when a save lands (not on unsave, not on mount).
  const saveBurstId = useBurstOnActivate(isSaved);
  const saveCount = useLiveSaveCount(meal);

  // Save feedback (flight to Profile, toasts, errors) comes from the
  // shared actions, the same as every other save button.
  const toggle = () => {
    if (onPress) return onPress();
    void saved.toggle(meal);
  };

  return (
    <SoftShade size={72} strength={0.22}>
      <View className="items-center gap-0.5">
        {!hideButton && (
          <View>
            <Confetti burstId={saveBurstId} />
            <Pressable
              onPress={toggle}
              accessibilityLabel={isSaved ? "Unsave meal" : "Save meal"}
              className={`h-9 w-9 items-center justify-center rounded-full border ${
                isSaved ? "border-primary bg-primary" : "border-white/20 bg-white/15"
              }`}
            >
              <Bookmark color={colors.white} size={16} fill={isSaved ? colors.white : "none"} />
            </Pressable>
          </View>
        )}
        {/* Hidden at zero, keeps its line. */}
        <Text
          accessibilityLabel={`Saved by ${saveCount}`}
          className={`font-inter-semibold text-sub text-white ${saveCount > 0 ? "opacity-100" : "opacity-0"}`}
        >
          {saveCount}
        </Text>
      </View>
    </SoftShade>
  );
}
