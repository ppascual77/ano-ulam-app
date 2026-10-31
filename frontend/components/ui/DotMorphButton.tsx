import { useRef, useState } from "react";
import { Pressable, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/frontend/constants/theme";
import { AppText } from "./AppText";

// The dot it becomes (what a flying dot picks up from).
const DOT = 14;
// A Button's height (py-3.5 around a "title" label).
const BUTTON_H = 52;
const RADIUS = { default: 12, pill: BUTTON_H / 2 } as const;
const EASE = Easing.inOut(Easing.cubic);

/** A point in window coordinates, with the dot's size there. */
export type DotSpot = { x: number; y: number; size: number };

type DotMorphButtonProps = {
  label: string;
  /** "default": spans its parent, like Button's default. "pill": hugs its
   *  label at its parent's left edge, fully rounded, like Button's pill. */
  shape?: keyof typeof RADIUS;
  /** Right on press, as the morph starts (e.g. to clear the screen around it). */
  onPress?: () => void;
  /** The button has become a dot at this spot: fly it somewhere. Null under
   *  reduce motion (no morph, no dot). */
  onDone: (spot: DotSpot | null) => void;
  reduceMotion: boolean;
};

// Looks like a primary Button. Pressed, its label fades, it turns orange and
// shrinks to a dot, then hands that dot's spot to onDone ("Got it" in the
// numbers explainer, "Get Started" on the intro). Fires once: remount it
// (key) to use it again.
export function DotMorphButton({ label, shape = "default", onPress, onDone, reduceMotion }: DotMorphButtonProps) {
  const ref = useRef<ViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [pressed, setPressed] = useState(false);
  const radius = RADIUS[shape];

  // 1 = a dot, 0 = full size; 1 = orange, 0 = green; label 0..1.
  const shrink = useSharedValue(0);
  const orange = useSharedValue(0);
  const labelOpacity = useSharedValue(1);

  // A plain function for the animation callback to call back to (a worklet
  // mustn't capture the ref itself: it would get a frozen copy).
  const handOff = () => {
    const node = ref.current;
    if (!node) return onDone(null);
    node.measureInWindow((x, y, w, h) => onDone(w ? { x: x + w / 2, y: y + h / 2, size: w } : null));
  };

  const press = () => {
    if (pressed) return;
    setPressed(true);
    onPress?.();
    if (reduceMotion) return onDone(null);
    labelOpacity.value = withTiming(0, { duration: 120 });
    orange.value = withTiming(1, { duration: 200 });
    shrink.value = withDelay(100, withTiming(1, { duration: 350, easing: EASE }, (finished) => {
      if (finished) scheduleOnRN(handOff);
    }));
  };

  const shapeStyle = useAnimatedStyle(() => {
    const s = shrink.value;
    return {
      width: width + (DOT - width) * s,
      height: BUTTON_H + (DOT - BUTTON_H) * s,
      borderRadius: radius + (DOT / 2 - radius) * s,
      backgroundColor: interpolateColor(orange.value, [0, 1], [colors.primary, colors.accent]),
    };
  });
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  return (
    // A fixed slot, measured once: the button fills it and shrinks to its
    // center, without the layout around it moving. A pill sizes the slot to
    // its label first.
    <View
      className={`items-center justify-center ${shape === "pill" ? "self-start" : "w-full"}`}
      style={{ height: BUTTON_H, width: width || undefined }}
      onLayout={(e) => !width && setWidth(e.nativeEvent.layout.width)}
    >
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={pressed}
        style={!width && shape === "default" ? { alignSelf: "stretch" } : undefined}
      >
        <Animated.View
          ref={ref}
          collapsable={false}
          className={`items-center justify-center overflow-hidden ${width ? "" : "px-5"}`}
          style={width ? shapeStyle : { height: BUTTON_H, borderRadius: radius, backgroundColor: colors.primary }}
        >
          <Animated.View style={labelStyle}>
            <AppText variant="title" className="text-white" numberOfLines={1}>
              {label}
            </AppText>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
