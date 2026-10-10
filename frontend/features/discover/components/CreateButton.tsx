import { type RefObject, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { BorderLap } from "./BorderLap";

// Width of the "Create" label area when expanded (the + circle is separate).
const LABEL_WIDTH = 64;
// The + circle.
const CIRCLE = 44;
// The intro's dot shrinks to this as the + takes it in.
const LANDING_DOT = 4;
// Absorbing the dot: a quick swell with an orange flush, then the border lap.
const PULSE_UP_MS = 120;
const FLUSH_MS = 450;
const LAP_DELAY_MS = 250;

// dark: glass over the Recipes reel. light: solid brand green on Community.
const variantClass = {
  dark: "border border-white/20 bg-white/15",
  light: "bg-brand-green",
} as const;

type CreateButtonProps = {
  expanded: boolean;
  onPress: () => void;
  variant: keyof typeof variantClass;
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
  }, [highlightId, pulse, flush]);

  const labelStyle = useAnimatedStyle(() => ({
    width: LABEL_WIDTH * progress.value,
    opacity: progress.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const flushStyle = useAnimatedStyle(() => ({ opacity: flush.value }));

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Create"
        className={`h-11 flex-row items-center overflow-hidden rounded-full ${variantClass[variant]}`}
      >
        <Animated.View style={labelStyle} className="items-end overflow-hidden">
          <Text numberOfLines={1} className="pl-4 font-inter-medium text-body text-white">
            Create
          </Text>
        </Animated.View>
        <View className="h-11 w-11 items-center justify-center">
          {/* The orange flush as the + takes in the dot (behind the +). */}
          <Animated.View pointerEvents="none" className="absolute inset-0 rounded-full bg-accent" style={flushStyle} />
          <Plus color={colors.white} size={20} />
        </View>
      </Pressable>
      <View pointerEvents="none" className="absolute right-0 top-0" style={{ width: CIRCLE, height: CIRCLE }}>
        {landingRef && (
          <View
            ref={landingRef}
            collapsable={false}
            style={{
              position: "absolute",
              left: (CIRCLE - LANDING_DOT) / 2,
              top: (CIRCLE - LANDING_DOT) / 2,
              width: LANDING_DOT,
              height: LANDING_DOT,
            }}
          />
        )}
        <BorderLap size={CIRCLE} runId={highlightId} delay={LAP_DELAY_MS} />
      </View>
    </Animated.View>
  );
}
