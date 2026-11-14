import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Gift } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { RECIPE_REWARD_DAYS } from "../proContent";

// One line on Pro rewards for the sign-up moments (the login gate sheets,
// onboarding's account slide): an accent gift and "Share your first recipe,
// get 7 days of Pro free." The reward itself is granted by the database
// when the recipe is approved.
export function EarnProNote() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-5 w-5 items-center justify-center rounded-full bg-accent">
        <Gift color={colors.white} size={11} strokeWidth={2.5} />
      </View>
      <Text className="flex-1 font-inter-regular text-body text-ink-emphasis">
        Share your first recipe, get <Text className="font-inter-semibold text-accent">{RECIPE_REWARD_DAYS} days of Pro free</Text>
      </Text>
    </View>
  );
}
