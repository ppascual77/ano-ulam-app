import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMealPlan } from "@/api/mealPlans";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { planKey, useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { dayTotals, type MealPlan } from "@/frontend/features/meal-planner/utils/generatePlan";
import type { NutritionGoals } from "@/api/auth";
import { PlanWeekCard } from "./PlanWeekCard";

const EASE = Easing.out(Easing.cubic);

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// The day against the goals: one line ("1,670 / 2,000 kcal · 103 / 120 g
// protein") over a slim calorie bar that fills on show.
function GoalLine({ calories, protein, goals }: { calories: number; protein: number; goals: NutritionGoals }) {
  const reduceMotion = useReduceMotion();
  const fill = useSharedValue(0);
  const share = goals.calories ? Math.min(calories / goals.calories, 1) : goals.protein ? Math.min(protein / goals.protein, 1) : 0;
  useEffect(() => {
    fill.value = withDelay(reduceMotion ? 0 : 200, withTiming(share, { duration: reduceMotion ? 0 : 700, easing: EASE }));
  }, [share, fill, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const parts = [
    goals.calories ? { value: calories, goal: goals.calories, unit: "kcal" } : null,
    goals.protein ? { value: protein, goal: goals.protein, unit: "g protein" } : null,
  ].filter((p): p is { value: number; goal: number; unit: string } => !!p);

  return (
    <View className="gap-1.5 border-t border-ink-emphasis/10 pt-3">
      <Text className="font-inter-regular text-small text-ink-subtle">
        {parts.map((p, i) => (
          <Text key={p.unit}>
            {i > 0 ? " · " : ""}
            <Text className="font-inter-semibold text-ink-emphasis">{Math.round(p.value).toLocaleString("en-PH")}</Text> / {p.goal.toLocaleString("en-PH")} {p.unit}
          </Text>
        ))}
      </Text>
      <View className="h-1.5 overflow-hidden rounded-full bg-ink-emphasis/10">
        <Animated.View style={[{ height: "100%" }, fillStyle]}>
          <View className="flex-1 rounded-full bg-primary" />
        </Animated.View>
      </View>
    </View>
  );
}

// The running plan, compact: today's three meals as the overlapping photos,
// which day it is, and (with nutrition goals) the day against them. Tap for
// the plan, opened on today.
function TodayPlan({ plan, dayIndex }: { plan: MealPlan; dayIndex: number }) {
  const goals = useNutritionGoals();
  const day = plan.days[dayIndex];
  const totals = dayTotals(day, plan.servings);
  const lastDay = dayIndex === plan.days.length - 1;
  const showGoals = !!goals && (!!goals.calories || !!goals.protein);

  return (
    <PlanWeekCard
      title="Today's plan"
      subtitle={lastDay ? "Last day of this plan" : `Day ${dayIndex + 1} of ${plan.days.length}`}
      photos={day.meals.map(({ meal }) => resolveMealImage(meal))}
      badge={null}
      footer={showGoals ? <GoalLine calories={totals.calories} protein={totals.protein} goals={goals!} /> : undefined}
      onPress={() => router.push({ pathname: "/meal-planner", params: { day: String(dayIndex) } })}
      accessibilityLabel={`Today's plan, day ${dayIndex + 1} of ${plan.days.length}: ${day.meals.map((m) => m.meal.name).join(", ")}. Open your meal plan`}
    />
  );
}

// While the saved plan loads: the card's shape, so nothing jumps or flashes.
function Placeholder() {
  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-ink-emphasis/10 px-4 py-3.5">
      <View className="h-11 w-24 rounded-full bg-ink-emphasis/5" />
      <View className="flex-1 gap-2">
        <View className="h-4 w-32 rounded bg-ink-emphasis/5" />
        <View className="h-3 w-40 rounded bg-ink-emphasis/5" />
      </View>
    </View>
  );
}

type CardState = { kind: "loading" } | { kind: "today"; plan: MealPlan; dayIndex: number } | { kind: "next" } | { kind: "start" };

// Home's one Meal Planner card, by where you are:
// - no plan: "Plan your week";
// - a plan running today: "Today's plan" (today's meals as the photos, day
//   N of M, and the day against your nutrition goals when set);
// - a plan that has ended: "Plan next week".
// Free plans only open day 1, so later days show "Plan your week".
// Switching states crossfades while the card eases to its new height.
function HomePlanCardInner() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const isPro = useIsPro();
  const { loading } = useSavedMealPlan();
  const plan = usePlannerStore((s) => s.plan);
  const saved = useQuery({ queryKey: planKey(userId), queryFn: getMealPlan, enabled: !!userId });
  const reduceMotion = useReduceMotion();

  const today = new Date();
  const dayIndex = plan ? plan.days.findIndex((d) => sameDay(d.date, today)) : -1;
  const state: CardState = loading
    ? { kind: "loading" }
    : plan && dayIndex >= 0 && (isPro || dayIndex === 0)
      ? { kind: "today", plan, dayIndex }
      : !plan && saved.data
        ? { kind: "next" }
        : { kind: "start" };

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(260).easing(EASE)}>
      <Animated.View key={state.kind} entering={FadeIn.duration(reduceMotion ? 150 : 260)}>
        {state.kind === "loading" && <Placeholder />}
        {state.kind === "today" && <TodayPlan plan={state.plan} dayIndex={state.dayIndex} />}
        {state.kind === "next" && <PlanWeekCard title="Plan next week" subtitle="Your budget and people are ready to go." />}
        {state.kind === "start" && <PlanWeekCard />}
      </Animated.View>
    </Animated.View>
  );
}

export const HomePlanCard = memo(HomePlanCardInner);
