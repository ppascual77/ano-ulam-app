import { type RefObject, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { FEED_TABS_HEIGHT } from "./FeedTabs";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LIQUID_GLASS = isLiquidGlassAvailable();
const SIZE = FEED_TABS_HEIGHT;
const CIRCLE = { borderRadius: SIZE / 2 };
// The intro's dot shrinks to this as it lands in the +.
const LANDING_DOT = 4;
// The highlight lap: an orange line once round the border, drawn along the
// circle's own edge so it can only ever sit on it.
const LAP_STROKE = 2;
const LAP_RADIUS = (SIZE - LAP_STROKE) / 2;
const LAP_LENGTH = 2 * Math.PI * LAP_RADIUS;
// Taking in the dot: a quick swell with an orange flush, then the lap runs
// and fades.
const PULSE_UP_MS = 120;
const FLUSH_MS = 450;
const LAP_DELAY_MS = 250;
const LAP_MS = 750;
const LAP_FADE_MS = 300;

// dark: liquid glass over the Recipes reel, like the tabs beside it. light:
// solid brand green on Community.
const variants = {
  dark: LIQUID_GLASS ? "border border-white/25" : Platform.OS === "ios" ? "border border-white/25 bg-black/20" : "border border-white/25 bg-black/45",
  light: "bg-brand-green",
} as const;

type CreateButtonProps = {
  onPress: () => void;
  variant: keyof typeof variants;
  /** An invisible spot at the +'s center: where Discover's intro dot lands
   *  (see usePageIntro's targetRef). */
  landingRef?: RefObject<ViewInstance | null>;
  /** Bumped when the intro's dot lands: the + swells with an orange flush,
   *  then an orange line runs once round its border. Intro only: a tap has
   *  no animation. */
  highlightId?: number;
};

// Discover's Create: a plain + circle the tabs' height, so the two line up.
// One tap opens the Create sheet (the screen owns that).
export function CreateButton({ onPress, variant, landingRef, highlightId = 0 }: CreateButtonProps) {
  const pulse = useSharedValue(1);
  const flush = useSharedValue(0);
  const lap = useSharedValue(0);
  const lapOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlightId === 0) return;
    pulse.value = withSequence(
      withTiming(1.15, { duration: PULSE_UP_MS, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 7, stiffness: 260, mass: 0.5 }),
    );
    flush.value = withSequence(withTiming(0.85, { duration: PULSE_UP_MS }), withTiming(0, { duration: FLUSH_MS, easing: Easing.out(Easing.quad) }));
    lap.value = 0;
    lap.value = withDelay(LAP_DELAY_MS, withTiming(1, { duration: LAP_MS, easing: Easing.inOut(Easing.quad) }));
    lapOpacity.value = withSequence(withTiming(1, { duration: 0 }), withDelay(LAP_DELAY_MS + LAP_MS, withTiming(0, { duration: LAP_FADE_MS })));
  }, [highlightId]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const flushStyle = useAnimatedStyle(() => ({ opacity: flush.value }));
  // Starts at the top (-90°) and runs clockwise as one growing dash.
  const lapProps = useAnimatedProps(() => ({
    strokeDashoffset: LAP_LENGTH * (1 - lap.value),
    strokeOpacity: lapOpacity.value,
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Create"
        style={[{ width: SIZE, height: SIZE }, CIRCLE]}
        className={`items-center justify-center overflow-hidden active:opacity-80 ${variants[variant]}`}
      >
        {variant === "dark" && LIQUID_GLASS && <GlassView glassEffectStyle="clear" style={[StyleSheet.absoluteFill, CIRCLE]} />}
        {variant === "dark" && !LIQUID_GLASS && Platform.OS === "ios" && (
          <BlurView intensity={25} tint="dark" pointerEvents="none" style={[StyleSheet.absoluteFill, CIRCLE]} />
        )}
        {/* The orange flush as the + takes in the dot (behind the +). */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, CIRCLE, { backgroundColor: colors.accent }, flushStyle]} />
        <Plus color={colors.white} size={20} strokeWidth={2.2} />
        {landingRef && (
          <View
            ref={landingRef}
            collapsable={false}
            pointerEvents="none"
            style={{ position: "absolute", width: LANDING_DOT, height: LANDING_DOT }}
          />
        )}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={LAP_RADIUS}
            fill="none"
            stroke={colors.accent}
            strokeWidth={LAP_STROKE}
            strokeLinecap="round"
            strokeDasharray={[LAP_LENGTH, LAP_LENGTH]}
            strokeOpacity={0}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            animatedProps={lapProps}
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}
