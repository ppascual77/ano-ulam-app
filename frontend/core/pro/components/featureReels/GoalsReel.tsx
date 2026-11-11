import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

const PERIOD_MS = 4200;
const FILL_MS = 1100;
// A meal's share of a day's targets (a third of ~1,800 kcal and ~100 g
// protein), drawn as the goal line on each bar.
const TARGET = { calories: 600, protein: 33 };
// Where the goal line sits along the bar: room to show a meal under or over.
const GOAL_AT = 0.78;

function Bar({ label, value, unit, target, active, reduceMotion, tick }: { label: string; value: number; unit: string; target: number; active: boolean; reduceMotion: boolean; tick: number }) {
  const share = Math.min(1, (value / target) * GOAL_AT);
  const fill = useSharedValue(reduceMotion ? share : 0);
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion || !active) {
      fill.value = share;
      setShown(value);
      return;
    }
    fill.value = 0;
    setShown(0);
    fill.value = withDelay(250, withTiming(share, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
    // The number counts up with the bar.
    const start = Date.now() + 250;
    const id = setInterval(() => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / FILL_MS));
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [tick, active, reduceMotion, value, share]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text className="font-inter-semibold text-sub text-ink-subtle">{label}</Text>
        <Text className="font-inter-bold text-sub text-ink-emphasis">
          {shown.toLocaleString()}
          {unit} <Text className="font-inter-medium text-ink-placeholder">/ {target.toLocaleString()}{unit}</Text>
        </Text>
      </View>
      <View className="h-2 justify-center">
        <View className="absolute left-0 right-0 h-2 rounded-full bg-ink-emphasis/10" />
        <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: colors.primary }, fillStyle]} />
        {/* The goal line. */}
        <View style={{ position: "absolute", left: `${GOAL_AT * 100}%`, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

// Nutrition goals: a real meal, its calories and protein filling toward a
// meal's share of your targets (the orange goal line), then a "Fits your
// goals" tag fading in. Reduce motion: filled, tag on.
export function GoalsReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { meals } = usePreferredMeals();
  // A meal that fits: high in protein, not over on calories.
  const meal = useMemo(() => {
    const perServing = meals.filter((m) => m.image_url).map((m) => scaleMeal(m, 1));
    return (
      perServing.find((m) => m.protein >= TARGET.protein * 0.85 && m.calories <= TARGET.calories * 1.15 && m.calories > 0) ??
      perServing[0] ??
      null
    );
  }, [meals]);
  const tick = useReelTick(active && !reduceMotion, PERIOD_MS);
  const [tagOn, setTagOn] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion || !active) return setTagOn(true);
    setTagOn(false);
    const id = setTimeout(() => setTagOn(true), 250 + FILL_MS + 150);
    return () => clearTimeout(id);
  }, [tick, active, reduceMotion]);

  if (!meal) return <View style={{ height: REEL_HEIGHT }} className="rounded-3xl bg-mood-bg" />;
  const calories = Math.round(meal.calories);
  const protein = Math.round(meal.protein);

  return (
    <View style={{ height: REEL_HEIGHT }} className="justify-center overflow-hidden rounded-3xl bg-mood-bg px-5">
      <View className="gap-3 rounded-2xl bg-white p-3.5 shadow-sm">
        <View className="flex-row items-center gap-3">
          <Image source={resolveMealImage(meal)} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="cover" />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-inter-bold text-body text-ink-emphasis">
              {meal.name}
            </Text>
            <Text className="font-inter-regular text-sub text-ink-subtle">1 serving</Text>
          </View>
        </View>
        <Bar label="Protein" value={protein} unit="g" target={TARGET.protein} active={active} reduceMotion={reduceMotion} tick={tick} />
        <Bar label="Calories" value={calories} unit="" target={TARGET.calories} active={active} reduceMotion={reduceMotion} tick={tick} />
      </View>
      <View className="mt-3 h-7 items-center">
        {tagOn && (
          <Animated.View key={tick} entering={reduceMotion ? undefined : FadeIn.duration(260)}>
            <View className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5">
              <Check color={colors.white} size={13} strokeWidth={3} />
              <Text className="font-inter-bold text-small text-white">Fits your goals</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
