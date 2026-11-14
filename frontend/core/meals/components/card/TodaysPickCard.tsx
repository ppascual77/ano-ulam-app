import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { ChevronRight, Clock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealSaveButton } from "@/frontend/core/meals/components/card/MealSaveButton";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { formatMealPrice } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const HEIGHT = 400;
// The photo's slow zoom: this much bigger, drifting this far left, over one
// pass (then back), on a loop.
const ZOOM = 0.06;
const DRIFT = 10;
const ZOOM_MS = 10_000;
// Over the photo: a light shade at the top for the pills, clear through the
// middle, dark at the bottom for the name.
const SHADE = ["rgba(0,0,0,0.4)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.8)"] as const;
const SHADE_AT = [0, 0.22, 0.45, 1] as const;

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const todayLabel = () => {
  const d = new Date();
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

type TodaysPickCardProps = {
  meal: MealType;
  onPress: () => void;
  /** Replaces the default save toggle (a guest's login gate). */
  onBookmarkPress?: () => void;
};

// Browse's "Today's pick" as the page's hero: a tall full-bleed photo (slowly
// zooming, unless Reduce motion is on) under a dark fade, the time and save
// on top, and today's date, the name, the price for its servings and "View
// recipe" over the photo. The whole card opens the meal's detail sheet.
export function TodaysPickCard({ meal, onPress, onBookmarkPress }: TodaysPickCardProps) {
  const reduce = useReduceMotion();
  const zoom = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(zoom);
      zoom.value = 0;
      return;
    }
    zoom.value = withRepeat(withTiming(1, { duration: ZOOM_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(zoom);
  }, [reduce, zoom]);
  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ZOOM * zoom.value }, { translateX: -DRIFT * zoom.value }],
  }));

  const servings = meal.serving_size ?? 1;
  return (
    // The shadow sits on this wrapper: on iOS the card's overflow-hidden
    // (which rounds the photo's corners) clips its own shadow away.
    <View className="rounded-3xl bg-white shadow-lg">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Today's pick, ${meal.name}, ${formatMealPrice(meal.price, meal.buffer_price)}`}
        style={{ height: HEIGHT }}
        className="overflow-hidden rounded-3xl bg-ink-emphasis/5 active:opacity-95"
      >
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, photoStyle]}>
          <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={300} />
        </Animated.View>
        <LinearGradient colors={SHADE} locations={SHADE_AT} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View className="absolute left-4 right-3 top-4 flex-row items-start justify-between">
          {meal.total_time != null ? (
            <View className="flex-row items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 py-1.5">
              <Clock color={colors.white} size={13} strokeWidth={2.5} />
              <Text className="font-inter-bold text-small text-white">{meal.total_time} min</Text>
            </View>
          ) : (
            <View />
          )}
          <MealSaveButton meal={meal} onPress={onBookmarkPress} />
        </View>

        <View className="absolute bottom-0 left-0 right-0 p-5">
          <Text className="font-inter-bold text-sub tracking-widest text-white/85">{todayLabel()}</Text>
          <Text numberOfLines={2} className="mt-1.5 font-inter-extrabold text-heading-lg tracking-display text-white">
            {meal.name}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="font-inter-extrabold text-heading tracking-display text-white">
              {formatMealPrice(meal.price, meal.buffer_price)}
              <Text className="font-inter-semibold text-small tracking-normal text-white/80">
                {"  "}for {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
            </Text>
            <View className="flex-row items-center gap-1 rounded-full border border-white/30 bg-white/20 py-2 pl-4 pr-3">
              <Text className="font-inter-bold text-small text-white">View recipe</Text>
              <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
