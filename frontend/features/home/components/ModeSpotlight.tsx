import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { Button } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const EASE = Easing.out(Easing.cubic);
// Room around the switch inside the cutout.
const PAD = 6;
const GAP = 14;

export type SpotlightRect = { x: number; y: number; width: number; height: number };

// A one-time spotlight on Home's By Budget / By Pantry switch: the screen
// dims around a rounded cutout, and a small card under it says what the two
// modes are. "Got it" or a tap anywhere closes it. Four dim panes around the
// hole (no mask needed), a thin ring on its edge.
export function ModeSpotlight({ rect, onDone }: { rect: SpotlightRect; onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const hole = { x: rect.x - PAD, y: rect.y - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
  const dim = "absolute bg-ink-emphasis/60";
  const fade = reduceMotion ? FadeIn.duration(150) : FadeIn.duration(260).easing(EASE);

  return (
    <Animated.View entering={fade} exiting={FadeOut.duration(180)} className="absolute inset-0" style={{ zIndex: 50 }}>
      <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="Close" className="absolute inset-0">
        <View className={dim} style={{ left: 0, top: 0, width: screenWidth, height: Math.max(hole.y, 0) }} />
        <View className={dim} style={{ left: 0, top: hole.y + hole.height, width: screenWidth, height: Math.max(screenHeight - hole.y - hole.height, 0) }} />
        <View className={dim} style={{ left: 0, top: hole.y, width: Math.max(hole.x, 0), height: hole.height }} />
        <View
          className={dim}
          style={{ left: hole.x + hole.width, top: hole.y, width: Math.max(screenWidth - hole.x - hole.width, 0), height: hole.height }}
        />
      </Pressable>

      {/* The ring on the cutout's edge. */}
      <View
        pointerEvents="none"
        className="absolute rounded-full border-2 border-white"
        style={{ left: hole.x, top: hole.y, width: hole.width, height: hole.height }}
      />

      <Animated.View
        entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.delay(120).duration(320).easing(EASE)}
        className="absolute left-5 right-5"
        style={{ top: hole.y + hole.height + GAP }}
      >
        <View accessible accessibilityRole="summary" className="rounded-2xl bg-white p-5 shadow-lg">
          <Text className="font-inter-bold text-body-lg text-ink-emphasis">Two ways to find your ulam</Text>
          <Text className="mt-2 font-inter-regular text-body text-ink">
            <Text className="font-inter-semibold text-ink-emphasis">By Budget:</Text> meals that fit what you want to spend.
          </Text>
          <Text className="mt-1 font-inter-regular text-body text-ink">
            <Text className="font-inter-semibold text-ink-emphasis">By Pantry:</Text> meals you can make with what&apos;s already in your
            kitchen.
          </Text>
          <View className="mt-4">
            <Button label="Got it" shape="pill" onPress={onDone} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
