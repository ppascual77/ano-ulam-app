import { Pressable, Text, View } from "react-native";
import { CalendarDays, ChevronRight, Dumbbell, Flame } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { SavedMealPlan } from "../../mock/api";

const GOAL_LABELS = { lose: "Lose fat", maintain: "Maintain", gain: "Build muscle" } as const;
const ACTIVITY_LABELS = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
} as const;

// Top of the Saved tab when the user has a saved 5-day plan.
export function MealPlanBanner({ plan, onPress }: { plan: SavedMealPlan; onPress: () => void }) {
  const { goal, activity } = plan.inputs;
  return (
    <Pressable
      onPress={onPress}
      className="mb-4 flex-row items-center gap-3 rounded-2xl border border-brand-green/20 px-4 py-3.5 active:scale-[0.99] active:bg-brand-green/10"
    >
      <View className="h-10 w-10 items-center justify-center">
        <CalendarDays color={colors.brandGreen.DEFAULT} size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-bold text-body text-web-ink">5-Day Meal Plan</Text>
        <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
          {goal && (
            <View className="flex-row items-center gap-1">
              <Dumbbell color={colors.webInk.body} size={10} />
              <Text className="font-inter-regular text-sub text-web-ink-body">{GOAL_LABELS[goal]}</Text>
            </View>
          )}
          <View className="flex-row items-center gap-1">
            <Flame color={colors.webInk.body} size={10} />
            <Text className="font-inter-regular text-sub text-web-ink-body">
              {plan.targets.calories.toLocaleString("en-PH")} kcal
            </Text>
          </View>
          <Text className="font-inter-regular text-sub text-web-ink-body">{plan.targets.protein}g protein</Text>
          {activity && (
            <Text className="font-inter-regular text-sub text-web-ink-muted">· {ACTIVITY_LABELS[activity]}</Text>
          )}
        </View>
      </View>
      <ChevronRight color={colors.webInk.muted} size={16} />
    </Pressable>
  );
}
