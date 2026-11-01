import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "lucide-react-native";
import { getMealPlan } from "@/api/mealPlans";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { planKey, useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { SLOT_LABELS, dayTotals, type MealPlan } from "@/frontend/features/meal-planner/utils/generatePlan";
import { PlanWeekCard } from "./PlanWeekCard";

const EASE = Easing.out(Easing.cubic);

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// One goal as a thin bar that fills on show: "1,850 / 2,000 kcal".
function GoalBar({ label, value, goal, unit, barClass, delay }: { label: string; value: number; goal: number; unit: string; barClass: string; delay: number }) {
  const fill = useSharedValue(0);
  const share = Math.min(value / goal, 1);
  useEffect(() => {
    fill.value = withDelay(delay, withTiming(share, { duration: 700, easing: EASE }));
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

// Today's meals from the running plan: what you're cooking, then (with
// nutrition goals) the day against them. Tap for the plan, opened on today.
function TodayPlan({ plan, dayIndex }: { plan: MealPlan; dayIndex: number }) {
  const reduceMotion = useReduceMotion();
  const goals = useNutritionGoals();
  const day = plan.days[dayIndex];
  const totals = dayTotals(day, plan.servings);
  const lastDay = dayIndex === plan.days.length - 1;
  const rowEnter = (i: number) => (reduceMotion ? FadeIn.duration(180) : FadeInDown.delay(80 + i * 70).duration(320).easing(EASE));

  return (
    <View className="gap-3 rounded-2xl border border-ink-emphasis/10 px-4 py-3.5">
      <Pressable
        onPress={() => router.push({ pathname: "/meal-planner", params: { day: String(dayIndex) } })}
        accessibilityRole="button"
        accessibilityLabel={`Today's plan, day ${dayIndex + 1} of ${plan.days.length}: ${day.meals.map((m) => m.meal.name).join(", ")}. Open your meal plan`}
        className="gap-3 active:opacity-70"
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-inter-bold text-subheading text-ink-emphasis">
            Today&apos;s plan<Text className="text-accent">.</Text>
          </Text>
          <View className="flex-row items-center gap-1">
            <View className={`rounded-full px-2.5 py-1 ${lastDay ? "bg-accent/10" : "bg-ink-emphasis/5"}`}>
              <Text className={`font-inter-semibold text-sub ${lastDay ? "text-accent" : "text-ink-subtle"}`}>
                {lastDay ? "LAST DAY" : `DAY ${dayIndex + 1} OF ${plan.days.length}`}
              </Text>
            </View>
            <ChevronRight color={colors.ink.subtle} size={16} />
          </View>
        </View>

        <View className="gap-2.5">
          {day.meals.map(({ slot, meal }, i) => (
            <Animated.View key={`${slot}-${meal.id}`} entering={rowEnter(i)}>
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 overflow-hidden rounded-full bg-ink-emphasis/5">
                  <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
                </View>
                <View className="flex-1">
                  <Text className="font-inter-medium text-sub uppercase text-ink-subtle">{SLOT_LABELS[slot]}</Text>
                  <Text className="mt-0.5 font-inter-semibold text-body text-ink-emphasis" numberOfLines={1}>
                    {meal.name}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        {goals && (goals.calories || goals.protein) && (
          <Animated.View entering={reduceMotion ? FadeIn.duration(180) : FadeIn.delay(320).duration(300)}>
            <View className="gap-2.5 border-t border-ink-emphasis/10 pt-3">
              {goals.calories && <GoalBar label="Calories" value={totals.calories} goal={goals.calories} unit="kcal" barClass="bg-primary" delay={reduceMotion ? 0 : 380} />}
              {goals.protein && <GoalBar label="Protein" value={totals.protein} goal={goals.protein} unit="g" barClass="bg-macro-protein" delay={reduceMotion ? 0 : 480} />}
            </View>
          </Animated.View>
        )}
      </Pressable>

      {lastDay && (
        <Pressable
          onPress={() => router.push("/meal-planner")}
          accessibilityRole="button"
          className="flex-row items-center justify-between border-t border-ink-emphasis/10 pt-3 active:opacity-70"
        >
          <Text className="font-inter-semibold text-small text-primary">Plan your next week</Text>
          <ArrowRight color={colors.primary} size={14} />
        </Pressable>
      )}
    </View>
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
// - a plan running today: "Today's plan" (today's meals, day N of M, goal
//   bars with nutrition goals), with "Plan your next week" on its last day;
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
