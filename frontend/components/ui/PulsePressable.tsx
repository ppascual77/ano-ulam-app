import { type GestureResponderEvent, Pressable, type PressableProps } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

const PRESS_IN_MS = 90;
// Springs back past full size, then settles.
const RELEASE_SPRING = { damping: 14, stiffness: 320, mass: 0.5 };
const RING_MS = 420;
// How hard it squishes, and how far (bigger than the button) and how
// strongly its ring shows as it fades. "subtle" for small, frequently tapped
// controls (the servings stepper), where the full pulse is a lot.
const PULSES = {
  default: { pressedScale: 0.93, ringGrowth: 0.35, ringOpacity: 0.25 },
  subtle: { pressedScale: 0.96, ringGrowth: 0.18, ringOpacity: 0.14 },
} as const;

type PulsePressableProps = PressableProps & {
  className?: string;
  /** The button's corner radius, so the ring matches its shape. Defaults to
   *  a circle. */
  radius?: number;
  ringColor?: string;
  /** How strong the pulse is. Defaults to "default". */
  pulse?: keyof typeof PULSES;
};

// A Pressable that pulses when tapped: squishes down on press, springs back
// with a little overshoot, and throws off a ring that grows and fades (e.g.
// the servings steppers). Otherwise a plain Pressable: className, style,
// hitSlop and onPress all pass through.
export function PulsePressable({
  className,
  radius = 999,
  ringColor = colors.primary,
  pulse = "default",
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: PulsePressableProps) {
  const { pressedScale, ringGrowth, ringOpacity } = PULSES[pulse];
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : ringOpacity * (1 - ring.value),
    transform: [{ scale: 1 + ringGrowth * ring.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.value = withTiming(pressedScale, { duration: PRESS_IN_MS });
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, RELEASE_SPRING);
    ring.value = 0;
    ring.value = withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) });
    onPressOut?.(e);
  };

  // Plain styles on the Animated.Views, className on the Pressable inside:
  // NativeWind can knock out Reanimated's animated values.
  return (
    <Animated.View style={scaleStyle}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 2, borderColor: ringColor },
          ringStyle,
        ]}
      />
      <Pressable
        {...props}
        disabled={disabled}
        className={className}
        onPressIn={disabled ? onPressIn : handlePressIn}
        onPressOut={disabled ? onPressOut : handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
