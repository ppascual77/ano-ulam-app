import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, FadeIn, ZoomIn, ZoomOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { SavedMeal } from "@/frontend/core/saved/types";

export type GroceryMealPickerData = {
  /** Every cookable saved meal, on the list or not. */
  meals: SavedMeal[];
  /** saved_ids switched off the list. */
  off: Set<string>;
  /** Per meal on the list: share of its "To buy" items picked up (null:
   *  needs nothing from the store). */
  progress: Map<string, number | null>;
  onToggle: (savedId: string) => void;
};

// The photo ring: a light track and a green arc that fills as the meal's
// ingredients are checked off. The photo sits inside with a white gap.
const BOX = 64;
const STROKE = 3;
const RADIUS = (BOX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PHOTO = 52;
const EASE = Easing.out(Easing.cubic);
// More meals than this and "See all" opens them as a grid.
const ROW_LIMIT = 4;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function MealBubble({ meal, on, progress, onToggle }: { meal: SavedMeal; on: boolean; progress: number | null; onToggle: () => void }) {
  const reduceMotion = useReduceMotion();
  const ready = on && progress === 1;
  const shownOn = useSharedValue(on ? 1 : 0);
  const fill = useSharedValue(on ? (progress ?? 0) : 0);
  useEffect(() => {
    shownOn.value = withTiming(on ? 1 : 0, { duration: reduceMotion ? 0 : 220, easing: EASE });
    fill.value = withTiming(on ? (progress ?? 0) : 0, { duration: reduceMotion ? 0 : 420, easing: EASE });
  }, [on, progress, reduceMotion]);

  const photoStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * shownOn.value }));
  const trackStyle = useAnimatedStyle(() => ({ opacity: shownOn.value }));
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.value) }));

  const state = !on ? "not on your list" : ready ? "on your list, all picked up" : "on your list";
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${meal.name}, ${state}`}
      className="items-center gap-1.5 active:opacity-70"
      style={{ width: BOX + 6 }}
    >
      <View style={{ width: BOX, height: BOX }}>
        {/* Plain style on the Animated nodes, className inside: NativeWind
            can knock out Reanimated's animated values. */}
        <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, trackStyle]}>
          <Svg width={BOX} height={BOX}>
            <Circle cx={BOX / 2} cy={BOX / 2} r={RADIUS} stroke={colors.primary} strokeOpacity={0.15} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RADIUS}
              stroke={colors.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              animatedProps={arcProps}
              // Starts at 12 o'clock.
              transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[{ position: "absolute", top: (BOX - PHOTO) / 2, left: (BOX - PHOTO) / 2 }, photoStyle]}>
          <Image
            source={resolveMealImage(meal)}
            style={{ width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2 }}
            contentFit="cover"
          />
        </Animated.View>
        {/* Everything it needs is picked up. It stays on the list until
            switched off by hand. */}
        {ready && (
          <Animated.View
            entering={reduceMotion ? undefined : ZoomIn.springify().damping(11)}
            exiting={reduceMotion ? undefined : ZoomOut.duration(150)}
            style={{ position: "absolute", right: -2, bottom: -2 }}
          >
            <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary">
              <Check color={colors.white} size={11} strokeWidth={3.5} />
            </View>
          </Animated.View>
        )}
      </View>
      <Text
        numberOfLines={1}
        className={`text-center text-small ${on ? (ready ? "font-inter-semibold text-primary" : "font-inter-semibold text-ink-emphasis") : "font-inter-medium text-ink-placeholder"}`}
        style={{ width: BOX + 6 }}
      >
        {meal.name}
      </Text>
    </Pressable>
  );
}

// "Cooking 3 of 13": which saved meals the list adds up. A row of meal
// photos to switch on and off (on: full color with a progress ring; off:
// faded); "See all" opens them as a grid.
export function GroceryMealPicker({ picker }: { picker: GroceryMealPickerData }) {
  const { meals, off, progress, onToggle } = picker;
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReduceMotion();
  if (meals.length === 0) return null;
  const onCount = meals.filter((meal) => !off.has(meal.saved_id)).length;
  const bubbles = meals.map((meal) => (
    <MealBubble
      key={meal.saved_id}
      meal={meal}
      on={!off.has(meal.saved_id)}
      progress={progress.get(meal.saved_id) ?? null}
      onToggle={() => onToggle(meal.saved_id)}
    />
  ));

  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between px-1">
        <Text className="font-inter-bold text-body-lg text-ink-emphasis">
          Cooking <Text className="font-inter-semibold text-body text-ink-placeholder">{onCount} of {meals.length}</Text>
        </Text>
        {meals.length > ROW_LIMIT && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={10} accessibilityRole="button" className="active:opacity-60">
            <Text className="font-inter-semibold text-small text-primary">{expanded ? "Show less" : "See all"}</Text>
          </Pressable>
        )}
      </View>
      {expanded ? (
        <Animated.View key="grid" entering={reduceMotion ? undefined : FadeIn.duration(200)} className="mt-3 flex-row flex-wrap gap-x-4 gap-y-3">
          {bubbles}
        </Animated.View>
      ) : (
        <ScrollView
          key="row"
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-6 mt-3"
          contentContainerClassName="gap-2 px-6"
        >
          {bubbles}
        </ScrollView>
      )}
    </View>
  );
}
