import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Image } from "expo-image";
import Animated, { Easing, FadeIn, FadeInLeft, LinearTransition, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

// Unlimited saved meals: meals drop into the saved row one by one while the
// counter climbs to the free cap ("10 / 10", the bar full); then the cap
// slides away and the count keeps going, 11, 12, 13... with no limit. Calm
// slides and fades, no pop. Reduce motion: past the cap, the bar gone.
const STEP_MS = 520;
const START = SAVED_MEALS_LIMIT - 3;
// Saves up to the cap, a beat on it, the cap goes, more saves, a rest.
const TO_CAP = SAVED_MEALS_LIMIT - START;
const HOLD = 2;
const BEYOND = 4;
const REST = 3;
const STEPS = TO_CAP + HOLD + BEYOND + REST + 1;
const THUMB = 46;
const SHOWN = 4;
const EASE = Easing.out(Easing.cubic);

function CapBar({ full, gone }: { full: number; gone: boolean }) {
  const width = useSharedValue(full);
  const fade = useSharedValue(1);
  useEffect(() => {
    width.value = withTiming(full, { duration: 300, easing: EASE });
  }, [full]);
  useEffect(() => {
    fade.value = withTiming(gone ? 0 : 1, { duration: 320, easing: EASE });
  }, [gone]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const box = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: (1 - fade.value) * 6 }] }));
  return (
    <Animated.View style={box} className="h-2 overflow-hidden rounded-full bg-ink-emphasis/10">
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, fill]} />
    </Animated.View>
  );
}

export function SavesReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const { meals } = usePreferredMeals();
  const photos = useMemo(() => meals.filter((m) => m.image_url).slice(0, 12), [meals]);
  const tick = useReelTick(active && !reduceMotion, STEP_MS);
  const step = reduceMotion ? TO_CAP + HOLD + BEYOND : tick % STEPS;
  const count = START + Math.min(step, TO_CAP) + Math.max(0, Math.min(step - TO_CAP - HOLD, BEYOND));
  const capGone = step > TO_CAP + HOLD - 1;
  // The newest saves first, each new one sliding in from the left.
  const recent = photos.length ? Array.from({ length: SHOWN }, (_, i) => ({ n: count - i, meal: photos[(count - i + photos.length) % photos.length] })) : [];

  return (
    <View style={{ height: REEL_HEIGHT }} className="justify-center gap-5 overflow-hidden rounded-3xl bg-mood-bg px-6">
      <View className="flex-row" style={{ gap: 8, height: THUMB }}>
        {recent.map(({ n, meal }) => (
          <Animated.View
            key={n}
            entering={reduceMotion ? undefined : FadeInLeft.duration(260).easing(EASE)}
            layout={reduceMotion ? undefined : LinearTransition.duration(260).easing(EASE)}
          >
            <Image source={resolveMealImage(meal)} style={{ width: THUMB, height: THUMB, borderRadius: 12 }} contentFit="cover" />
          </Animated.View>
        ))}
      </View>

      <View className="gap-2">
        <View className="flex-row items-end gap-1.5">
          <Text className="font-inter-extrabold text-heading-lg tracking-display text-ink-emphasis">{count}</Text>
          {/* The cap: there until the count reaches it, then it slides away. */}
          {!capGone ? (
            <Animated.Text key="cap" allowFontScaling={false} exiting={reduceMotion ? undefined : SlideOutUp.duration(300).easing(EASE)} className="mb-1.5 font-inter-semibold text-subheading text-ink-subtle">
              / {SAVED_MEALS_LIMIT}
            </Animated.Text>
          ) : (
            <Animated.Text key="free" allowFontScaling={false} entering={reduceMotion ? undefined : FadeIn.duration(300)} className="mb-1.5 font-inter-semibold text-subheading text-primary">
              and counting
            </Animated.Text>
          )}
        </View>
        <Text className="font-inter-regular text-small text-ink-subtle">{capGone ? "Saved meals, no limit" : "Saved meals"}</Text>
        <CapBar full={Math.min(count / SAVED_MEALS_LIMIT, 1)} gone={capGone} />
      </View>
    </View>
  );
}
