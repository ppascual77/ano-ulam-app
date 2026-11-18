import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MicronutrientList } from "@/frontend/core/meals/components/detail/MicronutrientList";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

// Fiber, sugar and sodium: a meal's card with the three rows locked (gray
// bars, a lock), then they open and the real rows come in, each % of daily
// value bar filling one after another (the meal page's own rows), and back.
// Reduce motion: the open card.
const STEP_MS = 700;
// 0-1 locked · 2-9 open (the bars grow in on entering) · loop.
const STEPS = 10;
// A sinigang na baboy serving, roughly: what the rows look like on a real meal.
const SAMPLE = { fiber: 4.2, sugar: 6.1, sodium: 980 };
const LOCKED_ROWS = ["Fiber", "Sugar", "Sodium"];

export function MicronutrientsReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const tick = useReelTick(active && !reduceMotion, STEP_MS);
  const step = reduceMotion ? STEPS - 1 : tick % STEPS;
  const open = step >= 2;
  // Each opening plays the bars' grow again.
  const cycle = Math.floor(tick / STEPS);

  return (
    <View style={{ height: REEL_HEIGHT }} className="justify-center overflow-hidden rounded-3xl bg-mood-bg px-5">
      <View className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text className="font-inter-bold text-body text-ink-emphasis">Sinigang na Baboy</Text>
          <Text className="font-inter-regular text-sub text-ink-subtle">per serving</Text>
        </View>
        <View style={{ height: 150 }}>
          {open ? (
            <Animated.View key={`open-${cycle}`} entering={reduceMotion ? undefined : FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
              <MicronutrientList values={SAMPLE} compact growDelay={reduceMotion ? 0 : 120} />
            </Animated.View>
          ) : (
            <Animated.View key={`locked-${cycle}`} entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} className="gap-4 p-4">
              {LOCKED_ROWS.map((label) => (
                <View key={label} className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-inter-semibold text-small text-ink-subtle">{label}</Text>
                    <Lock color={colors.ink.subtle} size={12} />
                  </View>
                  <View className="h-1.5 rounded-full bg-ink-emphasis/10" />
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
