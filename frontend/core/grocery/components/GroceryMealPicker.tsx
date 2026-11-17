import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { SavedMeal } from "@/frontend/core/saved/types";

export type GroceryMealPickerData = {
  /** Every cookable saved meal: all of them are on the list. */
  meals: SavedMeal[];
  /** Per meal: share of its main ingredients in the pantry (null: needs
   *  nothing from the store). */
  progress: Map<string, number | null>;
};

// The photo ring: a light track and a green arc that fills as the meal's
// ingredients reach the pantry. The photo sits inside with a white gap.
const BOX = 64;
const STROKE = 3;
const RADIUS = (BOX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PHOTO = 52;
const EASE = Easing.out(Easing.cubic);
// More meals than this and "See all" opens them as a grid.
const ROW_LIMIT = 4;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function MealBubble({ meal, progress }: { meal: SavedMeal; progress: number | null }) {
  const reduceMotion = useReduceMotion();
  const ready = progress === 1;
  const fill = useSharedValue(progress ?? 0);
  useEffect(() => {
    fill.value = withTiming(progress ?? 0, { duration: reduceMotion ? 0 : 420, easing: EASE });
  }, [progress, reduceMotion]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.value) }));

  return (
    <View
      accessible
      accessibilityLabel={`${meal.name}, ${ready ? "everything's in your pantry" : "still shopping"}`}
      className="items-center gap-1.5"
      style={{ width: BOX + 6 }}
    >
      <View style={{ width: BOX, height: BOX }}>
        {/* Plain style on the Animated nodes, className inside: NativeWind
            can knock out Reanimated's animated values. */}
        <View style={{ position: "absolute", top: 0, left: 0 }}>
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
        </View>
        <View style={{ position: "absolute", top: (BOX - PHOTO) / 2, left: (BOX - PHOTO) / 2 }}>
          <Image
            source={resolveMealImage(meal)}
            style={{ width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2 }}
            contentFit="cover"
          />
        </View>
        {/* Everything it needs is at home. It stays on the list until the
            morning nudge hears it was cooked (that unsaves it). */}
        {ready && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(220)}
            exiting={reduceMotion ? undefined : FadeOut.duration(150)}
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
        className={`text-center font-inter-semibold text-small ${ready ? "text-primary" : "text-ink-emphasis"}`}
        style={{ width: BOX + 6 }}
      >
        {meal.name}
      </Text>
    </View>
  );
}

// "Cooking 5": the saved meals the list adds up (saved means cooking it).
// A row of meal photos, each ring filling as its ingredients reach the
// pantry; "See all" opens them as a grid.
export function GroceryMealPicker({ picker }: { picker: GroceryMealPickerData }) {
  const { meals, progress } = picker;
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReduceMotion();
  if (meals.length === 0) return null;
  const bubbles = meals.map((meal) => <MealBubble key={meal.saved_id} meal={meal} progress={progress.get(meal.saved_id) ?? null} />);

  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between px-1">
        <Text className="font-inter-bold text-body-lg text-ink-emphasis">
          Cooking <Text className="font-inter-semibold text-body text-ink-placeholder">{meals.length}</Text>
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
