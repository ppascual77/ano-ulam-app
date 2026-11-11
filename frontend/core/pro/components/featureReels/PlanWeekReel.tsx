import { useMemo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from "react-native-reanimated";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const STEP_MS = 430;
// Steps per loop: fill to 5, hold on "5 days", fill to 7, hold, clear.
const FILLED_AT = [0, 1, 2, 3, 4, 5, 5, 5, 6, 7, 7, 7, 7];
const SLOT = 36;

// Meal plan length: a week strip filling with real meal photos one day at a
// time; it rests on "5-day plan", then the weekend fills in and it lands on
// "7-day plan". Reduce motion: the full week.
export function PlanWeekReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { meals } = usePreferredMeals();
  const photos = useMemo(() => meals.filter((m) => m.image_url).slice(0, 7).map(resolveMealImage), [meals]);
  const tick = useReelTick(active && !reduceMotion, STEP_MS);
  const filled = reduceMotion ? 7 : FILLED_AT[tick % FILLED_AT.length];
  const label = filled >= 7 ? "7-day plan" : filled >= 5 ? "5-day plan" : null;

  return (
    <View style={{ height: REEL_HEIGHT }} className="items-center justify-center overflow-hidden rounded-3xl bg-mood-bg px-4">
      <View className="w-full flex-row justify-between rounded-2xl bg-white px-3 py-4 shadow-sm">
        {DAYS.map((day, i) => {
          const on = i < filled;
          return (
            <View key={i} className="items-center gap-2">
              <Text className={`font-inter-bold text-sub ${on ? "text-primary" : "text-ink-placeholder"}`}>{day}</Text>
              <View
                style={{ width: SLOT, height: SLOT }}
                className={`items-center justify-center overflow-hidden rounded-xl ${on ? "" : "border border-dashed border-ink-emphasis/15"}`}
              >
                {on && (
                  <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} exiting={FadeOut.duration(150)}>
                    {photos[i] ? (
                      <Image source={photos[i]} style={{ width: SLOT, height: SLOT }} contentFit="cover" />
                    ) : (
                      <View style={{ width: SLOT, height: SLOT }} className="bg-primary/20" />
                    )}
                  </Animated.View>
                )}
              </View>
              {/* Breakfast, lunch, dinner: three ticks under each planned day. */}
              <View className="flex-row gap-0.5">
                {[0, 1, 2].map((k) => (
                  <View key={k} className={`h-1 w-1.5 rounded-full ${on ? "bg-accent" : "bg-ink-emphasis/10"}`} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      <View className="mt-4 h-8 items-center justify-center">
        {label && (
          <Animated.View key={label} entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.springify().damping(14)}>
            <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${filled >= 7 ? "bg-accent" : "bg-primary/10"}`}>
              <Text className={`font-inter-extrabold text-small ${filled >= 7 ? "text-white" : "text-primary"}`}>{label}</Text>
              <Text className={`font-inter-semibold text-sub ${filled >= 7 ? "text-white/80" : "text-primary/70"}`}>
                · {filled * 3} meals
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
