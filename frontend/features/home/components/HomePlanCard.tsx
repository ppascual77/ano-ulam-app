import { memo, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { SLOT_LABELS, dayTotals, upNextSlot, type MealPlan } from "@/frontend/features/meal-planner/utils/generatePlan";
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

// Over the hero photo: clear at the top, darker at the bottom so the white
// text stays readable on any photo (raw values: gradients can't take
// classes).
const PHOTO_SHADE = ["rgba(0,0,0,0.15)", "rgba(0,0,0,0)", "rgba(0,0,0,0.7)"] as const;
const PHOTO_HEIGHT = 176;

// The running plan as Home's lead: the meal that's up next fills the top
// (its photo, "Tonight" or "Up next · Lunch", its name, which day of the
// plan), the day's other two meals sit in a strip under it, then (with
// nutrition goals) the day against them. Tap
// anywhere for the plan, opened on today.
function TodayPlan({ plan, dayIndex }: { plan: MealPlan; dayIndex: number }) {
  const goals = useNutritionGoals();
  const reduceMotion = useReduceMotion();
  const day = plan.days[dayIndex];
  const totals = dayTotals(day, plan.servings);
  const lastDay = dayIndex === plan.days.length - 1;
  const showGoals = !!goals && (!!goals.calories || !!goals.protein);
  const nextSlot = upNextSlot();
  const next = day.meals.find((m) => m.slot === nextSlot) ?? day.meals[0];
  const eyebrow = next.slot === "dinner" ? "Tonight" : `Up next · ${SLOT_LABELS[next.slot]}`;
  const enter = (delay: number) => (reduceMotion ? FadeIn.duration(150) : FadeInDown.delay(delay).duration(360).easing(EASE));

  return (
    // The shadow sits on this wrapper: on iOS the card's overflow-hidden
    // (which rounds the photo's corners) clips its own shadow away.
    <View className="rounded-3xl bg-white shadow-sm">
      <Pressable
        onPress={() => router.push({ pathname: "/meal-planner", params: { day: String(dayIndex) } })}
        accessibilityRole="button"
        accessibilityLabel={`Today's plan, day ${dayIndex + 1} of ${plan.days.length}. ${eyebrow}: ${next.meal.name}. Open your meal plan`}
        // No border: it sat inside the clip and inset the photo by 1px, which
        // showed as white strips over HomeBackdrop's dark green.
        className="overflow-hidden rounded-3xl bg-white active:opacity-90"
      >
        <View style={{ height: PHOTO_HEIGHT }}>
          <Image source={resolveMealImage(next.meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={250} />
          <LinearGradient colors={PHOTO_SHADE} locations={[0, 0.35, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View className="absolute left-4 right-4 top-4 flex-row items-center justify-between">
            <Text className="font-inter-bold text-subheading text-white">
              Today&apos;s plan<Text className="text-brand-orange">.</Text>
            </Text>
            <View className={`rounded-full px-2.5 py-1 ${lastDay ? "bg-accent" : "bg-black/35"}`}>
              <Text className="font-inter-semibold text-sub text-white">{lastDay ? "LAST DAY" : `DAY ${dayIndex + 1} OF ${plan.days.length}`}</Text>
            </View>
          </View>
          <Animated.View entering={enter(80)} style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
            <Text className="font-inter-bold text-sub uppercase text-white/80">{eyebrow}</Text>
            <Text className="mt-1 font-inter-extrabold text-heading tracking-display text-white" numberOfLines={2}>
              {next.meal.name}
            </Text>
          </Animated.View>
        </View>

        <View className="gap-3 px-4 pb-4 pt-3">
          {/* The day's other two meals (the next one is in the photo). */}
          <View className="flex-row gap-2">
            {day.meals
              .filter(({ slot }) => slot !== next.slot)
              .map(({ slot, meal }, i) => (
                <Animated.View key={`${slot}-${meal.id}`} entering={enter(160 + i * 60)} style={{ flex: 1 }}>
                  <View className="flex-row items-center gap-2.5 rounded-2xl bg-ink-emphasis/5 px-2.5 py-2">
                    <View className="h-9 w-9 overflow-hidden rounded-full bg-white">
                      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-sub uppercase text-ink-subtle">{SLOT_LABELS[slot]}</Text>
                      <Text className="mt-0.5 font-inter-semibold text-small text-ink-emphasis" numberOfLines={1}>
                        {meal.name}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
          </View>
          {showGoals && <GoalLine calories={totals.calories} protein={totals.protein} goals={goals!} />}
        </View>
      </Pressable>
    </View>
  );
}

// While the saved plan loads: a card the size of the invitation, so nothing
// jumps or flashes.
function Placeholder() {
  return (
    <View className="flex-row items-center gap-4 rounded-3xl bg-white px-5 py-5 shadow-sm">
      <View className="flex-1 gap-2.5">
        <View className="h-3 w-24 rounded bg-ink-emphasis/5" />
        <View className="h-6 w-44 rounded bg-ink-emphasis/5" />
        <View className="h-3 w-52 rounded bg-ink-emphasis/5" />
        <View className="mt-1 h-8 w-32 rounded-full bg-ink-emphasis/5" />
      </View>
      <View className="h-20 w-20 rounded-2xl bg-ink-emphasis/5" />
    </View>
  );
}

type CardState = { kind: "loading" } | { kind: "today"; plan: MealPlan; dayIndex: number } | { kind: "next" } | { kind: "start" };

// Home's one Meal Planner card, by where you are:
// - no plan: "Plan your week";
// - a plan running today: "Today's plan", a photo-led card with the meal
//   that's up next, today's three, and the day vs your nutrition goals;
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
        {state.kind === "next" && <PlanWeekCard title="Plan next week" subtitle="Your last plan ended. Your budget and people are ready to go." cta="Plan again" />}
        {state.kind === "start" && <PlanWeekCard />}
      </Animated.View>
    </Animated.View>
  );
}

export const HomePlanCard = memo(HomePlanCardInner);
