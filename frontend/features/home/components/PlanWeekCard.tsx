import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { CalendarDays, ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Meal Planner's way in, since Profile took its bottom nav tab: planning is
// a weekly (Pro) task, not a daily destination.
// TODO: gate behind Pro (usePlannerStore's isPremium / the planner's locked
// state) once Pro is decided; for now it just opens the planner.
export function PlanWeekCard() {
  return (
    <Pressable
      onPress={() => router.push("/meal-planner")}
      accessibilityRole="button"
      accessibilityLabel="Plan your week, a Pro feature. Meals and a grocery list for 7 days, built around your budget."
      className="flex-row items-center gap-3 rounded-3xl border border-primary/15 bg-tinted-bg px-4 py-3.5 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
        <CalendarDays color={colors.primary} size={22} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-inter-bold text-subheading text-ink-emphasis">
            Plan your week<Text className="text-accent">.</Text>
          </Text>
          <View className="rounded-full bg-accent px-2 py-0.5">
            <Text className="font-inter-extrabold text-sub text-white">PRO</Text>
          </View>
        </View>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">
          Meals and a grocery list for 7 days, built around your budget.
        </Text>
      </View>
      <ChevronRight color={colors.primary} size={20} />
    </Pressable>
  );
}
