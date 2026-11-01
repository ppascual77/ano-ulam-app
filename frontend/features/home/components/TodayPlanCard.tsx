import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { dayTotals } from "@/frontend/features/meal-planner/utils/generatePlan";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// One goal as a thin bar that fills on show: "1,850 / 2,000 kcal".
function GoalBar({ label, value, goal, unit, barClass, delay }: { label: string; value: number; goal: number; unit: string; barClass: string; delay: number }) {
  const fill = useSharedValue(0);
  const share = Math.min(value / goal, 1);
  useEffect(() => {
    fill.value = withDelay(delay, withTiming(share, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [share, delay, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-inter-medium text-small text-ink-subtle">{label}</Text>
        <Text className="font-inter-semibold text-small text-ink-emphasis">
          {Math.round(value).toLocaleString("en-PH")} <Text className="font-inter-regular text-ink-subtle">/ {goal.toLocaleString("en-PH")} {unit}</Text>
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-ink-emphasis/10">
        <Animated.View style={[{ height: "100%" }, fillStyle]}>
          <View className={`flex-1 rounded-full ${barClass}`} />
        </Animated.View>
      </View>
    </View>
  );
}

// Pro, with nutrition goals and a running meal plan: today's planned meals
// against the daily goals, from the plan (no logging: what's planned is
// what counts). Tap for the plan. Hidden otherwise.
function TodayPlanCardInner() {
  useSavedMealPlan();
  const plan = usePlannerStore((s) => s.plan);
  const goals = useNutritionGoals();
  const today = plan?.days.find((day) => sameDay(day.date, new Date()));
  if (!plan || !goals || !today || (!goals.calories && !goals.protein)) return null;
  const totals = dayTotals(today, plan.servings);

  return (
    <Pressable
      onPress={() => router.push("/meal-planner")}
      accessibilityRole="button"
      accessibilityLabel={`Today's plan: ${Math.round(totals.calories)} calories${goals.calories ? ` of ${goals.calories}` : ""}. Open your meal plan`}
      className="gap-3 rounded-2xl border border-ink-emphasis/10 px-4 py-3.5 active:opacity-70"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-bold text-subheading text-ink-emphasis">
          Today&apos;s plan<Text className="text-accent">.</Text>
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="font-inter-regular text-small text-ink-subtle">vs your goals</Text>
          <ChevronRight color={colors.ink.subtle} size={16} />
        </View>
      </View>
      {goals.calories && <GoalBar label="Calories" value={totals.calories} goal={goals.calories} unit="kcal" barClass="bg-primary" delay={100} />}
      {goals.protein && <GoalBar label="Protein" value={totals.protein} goal={goals.protein} unit="g" barClass="bg-macro-protein" delay={220} />}
    </Pressable>
  );
}

export const TodayPlanCard = memo(TodayPlanCardInner);
