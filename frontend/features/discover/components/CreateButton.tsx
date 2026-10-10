import { type RefObject, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Width of the "Create" label area when expanded (the + circle is separate).
const LABEL_WIDTH = 64;
// The pill's height, and the + circle's size.
const HEIGHT = 44;
// The border is drawn (not a CSS border), so the highlight lap can run
// along that exact line: the lap is the border itself turning orange.
const BORDER = 1;
const LAP_STROKE = 2;
// The outline runs along the border's center line, half a border in.
const RADIUS = (HEIGHT - BORDER) / 2;
// The perimeter at full width: the dash pattern's length, so one dash can
// cover the whole outline at any width.
const MAX_PERIMETER = 2 * LABEL_WIDTH + 2 * Math.PI * RADIUS;

// The pill's outline at this label width, as one path that starts at the
// top of the + circle and runs clockwise (round the +, along the bottom,
// round the left end, back along the top). Collapsed, it's just the circle.
function outline(labelWidth: number) {
  "worklet";
  const top = BORDER / 2;
  const bottom = HEIGHT - BORDER / 2;
  const plusX = labelWidth + HEIGHT / 2;
  const leftX = HEIGHT / 2;
  return (
    `M ${plusX} ${top} A ${RADIUS} ${RADIUS} 0 0 1 ${plusX} ${bottom} ` +
    `L ${leftX} ${bottom} A ${RADIUS} ${RADIUS} 0 0 1 ${leftX} ${top} Z`
  );
}
// The intro's dot shrinks to this as the + takes it in.
const LANDING_DOT = 4;
// Absorbing the dot: a quick swell with an orange flush, then the border
// runs one orange lap and settles back.
const PULSE_UP_MS = 120;
const FLUSH_MS = 450;
const LAP_DELAY_MS = 250;
const LAP_MS = 750;
const LAP_FADE_MS = 300;

// dark: glass over the Recipes reel. light: solid brand green on Community.
const variants = {
  dark: { className: "bg-white/15", border: "rgba(255,255,255,0.2)" },
  light: { className: "bg-brand-green", border: colors.brandGreen.DEFAULT },
} as const;

type CreateButtonProps = {
  expanded: boolean;
  onPress: () => void;
  variant: keyof typeof variants;
  /** An invisible spot at the + circle's center: where Discover's intro
   *  dot lands, into the button (see usePageIntro's targetRef). */
  landingRef?: RefObject<View | null>;
  /** Bump to run the highlight: the + pulses with an orange flush, then
   *  its border runs one orange lap. */
  highlightId?: number;
};

// 44px pill. Collapsed: a + circle. Expanded: "Create" slides/fades in to
// the left of the +. The screen owns the two-tap behavior (1st tap expands,
// 2nd collapses and opens the Create sheet).
export function CreateButton({ expanded, onPress, variant, landingRef, highlightId = 0 }: CreateButtonProps) {
  const progress = useSharedValue(expanded ? 1 : 0);
  const pulse = useSharedValue(1);
  const flush = useSharedValue(0);
  const lap = useSharedValue(0);
  const lapOpacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [expanded, progress]);

  useEffect(() => {
    if (highlightId === 0) return;
    pulse.value = withSequence(
      withTiming(1.15, { duration: PULSE_UP_MS, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 7, stiffness: 260, mass: 0.5 }),
    );
    flush.value = withSequence(
      withTiming(0.85, { duration: PULSE_UP_MS }),
      withTiming(0, { duration: FLUSH_MS, easing: Easing.out(Easing.quad) }),
    );
    lap.value = 0;
    lap.value = withDelay(LAP_DELAY_MS, withTiming(1, { duration: LAP_MS, easing: Easing.inOut(Easing.quad) }));
    lapOpacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(LAP_DELAY_MS + LAP_MS, withTiming(0, { duration: LAP_FADE_MS })),
    );
  }, [highlightId, pulse, flush, lap, lapOpacity]);

  const labelStyle = useAnimatedStyle(() => ({
    width: LABEL_WIDTH * progress.value,
    opacity: progress.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const flushStyle = useAnimatedStyle(() => ({ opacity: flush.value }));

  // The border follows the pill as it widens; the lap is the same outline
  // drawn as one growing dash, so it can only ever sit on the border.
  const borderProps = useAnimatedProps(() => ({ d: outline(LABEL_WIDTH * progress.value) }));
  const lapProps = useAnimatedProps(() => {
    const labelWidth = LABEL_WIDTH * progress.value;
    const perimeter = 2 * labelWidth + 2 * Math.PI * RADIUS;
    return {
      d: outline(labelWidth),
      strokeDashoffset: MAX_PERIMETER - perimeter * lap.value,
      strokeOpacity: lapOpacity.value,
    };
  });

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Create"
        className={`flex-row items-center overflow-hidden rounded-full ${variants[variant].className}`}
        style={{ height: HEIGHT }}
      >
        <Animated.View style={labelStyle} className="items-end overflow-hidden">
          <Text numberOfLines={1} className="pl-4 font-inter-medium text-body text-white">
            Create
          </Text>
        </Animated.View>
        <View className="items-center justify-center" style={{ width: HEIGHT, height: HEIGHT }}>
          {/* The orange flush as the + takes in the dot (behind the +). */}
          <Animated.View pointerEvents="none" className="absolute inset-0 rounded-full bg-accent" style={flushStyle} />
          <Plus color={colors.white} size={20} />
          {landingRef && (
            <View
              ref={landingRef}
              collapsable={false}
              pointerEvents="none"
              style={{ position: "absolute", width: LANDING_DOT, height: LANDING_DOT }}
            />
          )}
        </View>

        {/* The border, and the lap running along it. */}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <AnimatedPath
            fill="none"
            stroke={variants[variant].border}
            strokeWidth={BORDER}
            animatedProps={borderProps}
          />
          <AnimatedPath
            fill="none"
            stroke={colors.accent}
            strokeWidth={LAP_STROKE}
            strokeLinecap="round"
            strokeDasharray={[MAX_PERIMETER, MAX_PERIMETER]}
            strokeOpacity={0}
            animatedProps={lapProps}
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}
