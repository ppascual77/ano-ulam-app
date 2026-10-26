import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppText, LandingTitle, type LandingDot } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Home's meal-time picker. Calm by default: four neutral tiles, just the
// illustrations and labels. Color is reserved for the choice: one highlight
// in that category's pastel sits behind the selected tile.
//
// Motion, three beats:
//   press   the tile squeezes (0.95) and springs back
//   select  the highlight slides to the tile on a soft spring, blending into
//           that category's color on the way (grows in from nothing; shrinks
//           away on clear); a selection haptic
//   land    the chosen illustration hops (lifts, wiggles, settles back
//           untransformed, so it stays as sharp as the rest); the others dim
// An orange "now" dot marks the meal that fits the time of day, breathing
// twice when Home appears. Reduce motion: the highlight jumps, no hop,
// wiggle or breathing.

type CategoryId = "breakfast" | "lunch" | "dinner" | "fastfood";

const CATEGORIES: { id: CategoryId; label: string; image: number; tint: string }[] = [
  { id: "breakfast", label: "Breakfast", image: require("@/assets/icons/breakfast-category-logo.png"), tint: colors.category.breakfast },
  { id: "lunch", label: "Lunch", image: require("@/assets/icons/lunch-category-logo.png"), tint: colors.category.lunch },
  { id: "dinner", label: "Dinner", image: require("@/assets/icons/dinner-category-logo.png"), tint: colors.category.dinner },
  { id: "fastfood", label: "Fastfood", image: require("@/assets/icons/fastfood-category-logo.png"), tint: colors.category.fastfood },
];
const TINTS = CATEGORIES.map((c) => c.tint);
const STOPS = CATEGORIES.map((_, i) => i);

const GAP = 10;
const RADIUS = 16;
const ART = 56;
const SLIDE = { damping: 20, stiffness: 240, mass: 0.8 };
const PRESS = { damping: 15, stiffness: 400 };
const HOP = { damping: 9, stiffness: 260, mass: 0.6 };

// The meal that fits right now: breakfast 4-10am, lunch 10am-3pm, merienda
// (fastfood) 3-5pm, dinner 5-10pm, late-night fastfood otherwise.
function mealNow(hour: number): CategoryId {
  if (hour >= 4 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "fastfood";
}

type CategoriesSectionProps = {
  /** The title's period: Home's post-onboarding intro lands its dot here. */
  landing?: LandingDot;
};

export function CategoriesSection({ landing }: CategoriesSectionProps) {
  const reduce = useReduceMotion();
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [now] = useState(() => mealNow(new Date().getHours()));
  // One tile's width (the row is four equal tiles); the highlight's slot.
  const [tileW, setTileW] = useState(0);

  // The highlight: its position (in tiles, fractional while sliding), how
  // shown it is, and its color (blended by the same position).
  const index = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    const i = selected ? CATEGORIES.findIndex((c) => c.id === selected) : -1;
    if (i < 0) {
      shown.value = reduce ? 0 : withTiming(0, { duration: 180 });
      return;
    }
    if (shown.value < 0.05 || reduce) {
      // From nothing: appear at the tile rather than slide in from another.
      index.value = i;
      shown.value = reduce ? 1 : withSpring(1, SLIDE);
    } else {
      index.value = withSpring(i, SLIDE);
    }
  }, [selected, reduce, index, shown]);

  const highlight = useAnimatedStyle(() => ({
    opacity: shown.value,
    backgroundColor: interpolateColor(index.value, STOPS, TINTS),
    transform: [{ translateX: index.value * (tileW + GAP) }, { scale: 0.88 + 0.12 * shown.value }],
  }));

  const choose = (id: CategoryId) => {
    void Haptics.selectionAsync();
    setSelected((prev) => (prev === id ? null : id));
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <LandingTitle {...landing}>Categories</LandingTitle>
        {/* Only while a category is picked: clears the pick. */}
        {selected && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
            <Pressable onPress={() => setSelected(null)} hitSlop={8} accessibilityLabel="Clear category">
              <AppText variant="bodyMedium" className="text-primary">
                Clear
              </AppText>
            </Pressable>
          </Animated.View>
        )}
      </View>

      <View className="flex-row" style={{ gap: GAP }} onLayout={(e) => setTileW((e.nativeEvent.layout.width - GAP * 3) / 4)}>
        {tileW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: 0, bottom: 0, left: 0, width: tileW, borderRadius: RADIUS, borderWidth: 1.5, borderColor: `${colors.accent}66` },
              highlight,
            ]}
          />
        )}
        {CATEGORIES.map((category, i) => (
          <CategoryTile
            key={category.id}
            index={i}
            label={category.label}
            image={category.image}
            selected={selected === category.id}
            dimmed={selected != null && selected !== category.id}
            isNow={now === category.id}
            reduce={reduce}
            onPress={() => choose(category.id)}
          />
        ))}
      </View>
    </View>
  );
}

type CategoryTileProps = {
  index: number;
  label: string;
  image: number;
  selected: boolean;
  dimmed: boolean;
  isNow: boolean;
  reduce: boolean;
  onPress: () => void;
};

function CategoryTile({ index, label, image, selected, dimmed, isNow, reduce, onPress }: CategoryTileProps) {
  // Press squeeze.
  const press = useSharedValue(1);
  // The art's hop on select: lift and wiggle, then rest untransformed.
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const dim = useSharedValue(1);
  // Arrival: the tiles rise in one after another the first time.
  const enter = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) enter.value = withDelay(index * 60, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [enter, index, reduce]);

  useEffect(() => {
    if (selected && !reduce) {
      lift.value = withSequence(withTiming(-7, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, HOP));
      tilt.value = withSequence(withTiming(-7, { duration: 90 }), withTiming(5, { duration: 110 }), withSpring(0, HOP));
    }
    dim.value = reduce ? (dimmed ? 0.5 : 1) : withTiming(dimmed ? 0.5 : 1, { duration: 200 });
  }, [selected, dimmed, reduce, lift, tilt, dim]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }, { scale: press.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
    transform: [{ translateY: lift.value }, { rotate: `${tilt.value}deg` }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * dim.value }));

  return (
    <Animated.View style={[{ flex: 1 }, tileStyle]}>
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
        accessibilityLabel={isNow ? `${label}, fits right now` : label}
        className="items-center rounded-2xl border border-ink-emphasis/10 pb-2.5 pt-3"
        // Only override the border color when selected: passing undefined
        // wipes the class's gray and leaves React Native's default black.
        style={selected ? { borderRadius: RADIUS, borderColor: "transparent" } : { borderRadius: RADIUS }}
      >
        {isNow && <NowDot reduce={reduce} />}
        <Animated.View style={artStyle}>
          {/* Decoded at its 56px size (a clean downscale), and never left
              scaled or tilted: a transform stretches the drawn pixels, so the
              hop only moves it and it rests exactly like the others. The art
              is transparent, so the highlight shows through. */}
          <Image source={image} style={{ width: ART, height: ART }} contentFit="contain" />
        </Animated.View>
        <Animated.View style={labelStyle}>
          <AppText variant="bodyMedium" className={`mt-1.5 ${selected ? "font-inter-semibold text-ink-emphasis" : ""}`}>
            {label}
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// The "fits right now" dot: breathes twice when Home appears, then rests.
function NowDot({ reduce }: { reduce: boolean }) {
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (!reduce) breathe.value = withDelay(500, withRepeat(withSequence(withTiming(1.6, { duration: 420 }), withTiming(1, { duration: 420 })), 2));
  }, [breathe, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  return <Animated.View pointerEvents="none" className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-accent" style={style} />;
}
