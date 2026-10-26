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
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { NumbersReel } from "./NumbersReel";
import { measureDot, type DotPoint } from "./NumbersDot";

// The dot "Got it" is while it travels (the flying dot's size here).
const DOT = 14;
// A default Button's height (py-3.5 around a "title" label).
const BUTTON_H = 52;
const RADIUS = 12;
const EASE = Easing.inOut(Easing.cubic);

type NumbersExplainerSheetProps = {
  visible: boolean;
  /** Backdrop tap or drag down: just closes. */
  onClose: () => void;
  /** "Got it": the button has become a dot at `from`; close the sheet and
   *  fly it home. Null under reduce motion (no dot). */
  onGotIt: (from: DotPoint | null) => void;
  reduceMotion: boolean;
};

// Onboarding's "Where do our numbers come from?": the reel (NumbersReel)
// plays on open and ends on its summary. Inline (not a native Modal) so the
// dot "Got it" turns into can fly over the closing sheet.
export function NumbersExplainerSheet({ visible, onClose, onGotIt, reduceMotion }: NumbersExplainerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent presentation="inline">
      <View className="gap-5 px-6 pb-10 pt-8">
        <AppText variant="sectionTitle" dot>
          Where our numbers come from
        </AppText>

        {/* Mounted only while open, so it plays from the start each time. */}
        {visible && <NumbersReel />}

        {visible && <GotItButton onDone={onGotIt} reduceMotion={reduceMotion} />}
      </View>
    </BottomSheet>
  );
}

type GotItButtonProps = {
  onDone: (from: DotPoint | null) => void;
  reduceMotion: boolean;
};

// Looks like a primary Button. Pressed, its label fades, it turns orange
// and shrinks to a dot, then hands that dot's spot to onDone.
function GotItButton({ onDone, reduceMotion }: GotItButtonProps) {
  const ref = useRef<ViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [pressed, setPressed] = useState(false);

  // 1 = a dot, 0 = full size; 1 = orange, 0 = green; label 0..1.
  const shrink = useSharedValue(0);
  const orange = useSharedValue(0);
  const label = useSharedValue(1);

  // A plain function for the animation callback to call back to (a worklet
  // mustn't capture the ref itself: it would get a frozen copy).
  const handOff = () => measureDot(ref, onDone);

  const press = () => {
    if (pressed) return;
    setPressed(true);
    if (reduceMotion) return onDone(null);
    label.value = withTiming(0, { duration: 120 });
    orange.value = withTiming(1, { duration: 200 });
    shrink.value = withDelay(100, withTiming(1, { duration: 350, easing: EASE }, (finished) => {
      if (finished) scheduleOnRN(handOff);
    }));
  };

  const shape = useAnimatedStyle(() => {
    const s = shrink.value;
    return {
      width: width + (DOT - width) * s,
      height: BUTTON_H + (DOT - BUTTON_H) * s,
      borderRadius: RADIUS + (DOT / 2 - RADIUS) * s,
      backgroundColor: interpolateColor(orange.value, [0, 1], [colors.primary, colors.accent]),
    };
  });
  const labelStyle = useAnimatedStyle(() => ({ opacity: label.value }));

  return (
    // A fixed slot: the button fills it and grows or shrinks from its
    // center, without the sheet changing height.
    <View
      className="w-full items-center justify-center"
      style={{ height: BUTTON_H }}
      onLayout={(e) => !width && setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Pressable onPress={press} accessibilityRole="button" accessibilityLabel="Got it" disabled={pressed}>
          <Animated.View ref={ref} collapsable={false} className="items-center justify-center overflow-hidden" style={shape}>
            <Animated.View style={labelStyle}>
              <AppText variant="title" className="text-white" numberOfLines={1}>
                Got it
              </AppText>
            </Animated.View>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}
