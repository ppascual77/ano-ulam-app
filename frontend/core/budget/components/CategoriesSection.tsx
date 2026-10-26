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
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Hamburger, Moon, Sun, Sunrise, type LucideIcon } from "lucide-react-native";
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
// Each label carries a small time-of-day icon (sunrise, sun, moon, burger:
// left to right, the day). Gray at rest, like the label; selected, it takes
// its color and plays its own beat with the art's hop: the sunrise rises,
// the sun turns, the moon rocks, the burger squashes and bounces.
//
// Reduce motion: the highlight jumps, no hop, wiggle or icon beat (the icon
// still takes its color).

type CategoryId = "breakfast" | "lunch" | "dinner" | "fastfood";
type IconBeat = "rise" | "turn" | "rock" | "bounce";

const CATEGORIES: { id: CategoryId; label: string; image: number; tint: string; icon: LucideIcon; iconColor: string; beat: IconBeat }[] = [
  { id: "breakfast", label: "Breakfast", image: require("@/assets/icons/breakfast-category-logo.png"), tint: colors.category.breakfast, icon: Sunrise, iconColor: colors.accent, beat: "rise" },
  { id: "lunch", label: "Lunch", image: require("@/assets/icons/lunch-category-logo.png"), tint: colors.category.lunch, icon: Sun, iconColor: colors.primary, beat: "turn" },
  { id: "dinner", label: "Dinner", image: require("@/assets/icons/dinner-category-logo.png"), tint: colors.category.dinner, icon: Moon, iconColor: colors.category.dinnerIcon, beat: "rock" },
  { id: "fastfood", label: "Fastfood", image: require("@/assets/icons/fastfood-category-logo.png"), tint: colors.category.fastfood, icon: Hamburger, iconColor: colors.category.fastfoodIcon, beat: "bounce" },
];
const TINTS = CATEGORIES.map((c) => c.tint);
const STOPS = CATEGORIES.map((_, i) => i);

const GAP = 10;
const RADIUS = 16;
const ART = 56;
const ICON = 12;
// No overshoot on anything that sizes or moves a tile or the highlight: the
// row runs edge to edge inside Home's scroll view, which clips, so a spring
// past the outer tiles (or past 100%) got sliced off. The slide is
// critically damped (a glide that eases exactly into place).
const SLIDE = { damping: 30, stiffness: 260, mass: 0.8, overshootClamping: true };
const PRESS = { damping: 15, stiffness: 400, overshootClamping: true };
const HOP = { damping: 9, stiffness: 260, mass: 0.6 };

type CategoriesSectionProps = {
  /** The title's period: Home's post-onboarding intro lands its dot here. */
  landing?: LandingDot;
};

export function CategoriesSection({ landing }: CategoriesSectionProps) {
  const reduce = useReduceMotion();
  const [selected, setSelected] = useState<CategoryId | null>(null);
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
            icon={category.icon}
            iconColor={category.iconColor}
            beat={category.beat}
            selected={selected === category.id}
            dimmed={selected != null && selected !== category.id}
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
  icon: LucideIcon;
  iconColor: string;
  beat: IconBeat;
  selected: boolean;
  dimmed: boolean;
  reduce: boolean;
  onPress: () => void;
};

function CategoryTile({ index, label, image, icon, iconColor, beat, selected, dimmed, reduce, onPress }: CategoryTileProps) {
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
        accessibilityLabel={label}
        className="items-center rounded-2xl border border-ink-emphasis/10 pb-2.5 pt-3"
        // Only override the border color when selected: passing undefined
        // wipes the class's gray and leaves React Native's default black.
        style={selected ? { borderRadius: RADIUS, borderColor: "transparent" } : { borderRadius: RADIUS }}
      >
        <Animated.View style={artStyle}>
          {/* Decoded at its 56px size (a clean downscale), and never left
              scaled or tilted: a transform stretches the drawn pixels, so the
              hop only moves it and it rests exactly like the others. The art
              is transparent, so the highlight shows through. */}
          <Image source={image} style={{ width: ART, height: ART }} contentFit="contain" />
        </Animated.View>
        <Animated.View style={labelStyle} className="mt-1.5 flex-row items-center px-1">
          <TimeIcon icon={icon} color={iconColor} beat={beat} selected={selected} reduce={reduce} />
          {/* Four tiles are ~78px wide: shrinks a touch rather than wrap. */}
          <AppText
            variant="bodyMedium"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            className={`ml-1 shrink ${selected ? "font-inter-semibold text-ink-emphasis" : ""}`}
          >
            {label}
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// The label's time-of-day icon: gray at rest; selected, its color fades in
// and it plays its beat (sunrise rises, sun turns, moon rocks, burger
// squashes and bounces), then rests untransformed. Two stacked copies, gray
// and colored, cross-fade (an icon's color isn't animatable).
function TimeIcon({ icon: Icon, color, beat, selected, reduce }: { icon: LucideIcon; color: string; beat: IconBeat; selected: boolean; reduce: boolean }) {
  const on = useSharedValue(selected ? 1 : 0);
  const y = useSharedValue(0);
  const turn = useSharedValue(0);
  const squash = useSharedValue(1);

  useEffect(() => {
    on.value = reduce ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 220 });
    if (!selected || reduce) return;
    if (beat === "rise") {
      y.value = withSequence(withTiming(4, { duration: 0 }), withSpring(0, HOP));
    } else if (beat === "turn") {
      // A quarter turn of an 8-ray sun lands looking the same; then reset.
      turn.value = withSequence(withTiming(90, { duration: 520, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 0 }));
    } else if (beat === "rock") {
      turn.value = withSequence(withTiming(-20, { duration: 120 }), withTiming(12, { duration: 140 }), withSpring(0, HOP));
    } else {
      squash.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, HOP));
      y.value = withSequence(withTiming(0, { duration: 90 }), withTiming(-4, { duration: 110 }), withSpring(0, HOP));
    }
  }, [selected, reduce, beat, on, y, turn, squash]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${turn.value}deg` }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  const gray = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const colored = useAnimatedStyle(() => ({ opacity: on.value }));
  return (
    <Animated.View style={[{ width: ICON, height: ICON }, motion]}>
      <Animated.View style={[{ position: "absolute" }, gray]}>
        <Icon color={colors.ink.subtle} size={ICON} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute" }, colored]}>
        <Icon color={color} size={ICON} strokeWidth={2.2} />
      </Animated.View>
    </Animated.View>
  );
}
