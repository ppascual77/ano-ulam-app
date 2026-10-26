import { useEffect } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import type { PriceWatchCategory } from "../constants/categories";

// One Price Watch category: a neutral tile (the green highlight behind the
// selected one is CategoryGrid's). Pressed, it squeezes; selected, its photo
// hops (lifts, wiggles) and rests untransformed so it stays sharp; the
// others dim. The photos are transparent cut-outs, so the highlight shows
// through.

const ART = 40;
const PRESS = { damping: 15, stiffness: 400, overshootClamping: true };
const HOP = { damping: 9, stiffness: 260, mass: 0.6 };

type CategoryTileProps = {
  index: number;
  width: number;
  category: PriceWatchCategory;
  selected: boolean;
  dimmed: boolean;
  reduce: boolean;
  onPress: () => void;
  /** Reports the tile's height (the grid sizes its highlight from it). */
  onMeasure?: (height: number) => void;
};

export function CategoryTile({ index, width, category, selected, dimmed, reduce, onPress, onMeasure }: CategoryTileProps) {
  const press = useSharedValue(1);
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const dim = useSharedValue(1);
  const enter = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) enter.value = withDelay(index * 40, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
  }, [enter, index, reduce]);

  useEffect(() => {
    if (selected && !reduce) {
      lift.value = withSequence(withTiming(-6, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, HOP));
      tilt.value = withSequence(withTiming(-7, { duration: 90 }), withTiming(5, { duration: 110 }), withSpring(0, HOP));
    }
    dim.value = reduce ? (dimmed ? 0.5 : 1) : withTiming(dimmed ? 0.5 : 1, { duration: 200 });
  }, [selected, dimmed, reduce, lift, tilt, dim]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 8 }, { scale: press.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
    transform: [{ translateY: lift.value }, { rotate: `${tilt.value}deg` }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * dim.value }));

  return (
    <Animated.View style={[{ width }, tileStyle]} onLayout={onMeasure ? (e) => onMeasure(e.nativeEvent.layout.height) : undefined}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!reduce) press.value = withSpring(0.95, PRESS);
        }}
        onPressOut={() => {
          press.value = reduce ? 1 : withSpring(1, PRESS);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${category.label} category`}
        className="items-center gap-1 rounded-2xl border border-ink-emphasis/10 py-3"
        // Only override the border color when selected (undefined would wipe
        // the class's gray to React Native's default black).
        style={selected ? { borderRadius: 16, borderColor: "transparent" } : { borderRadius: 16 }}
      >
        <Animated.View style={artStyle}>
          <Image source={category.icon} style={{ width: ART, height: ART }} contentFit="contain" />
        </Animated.View>
        <Animated.View style={labelStyle}>
          <AppText
            variant="body"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            className={`px-1 leading-5 ${selected ? "font-inter-semibold text-primary" : "text-ink-emphasis"}`}
          >
            {category.label}
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
