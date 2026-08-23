import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// Past this fraction of the sheet's height (or a fast enough flick), a drag
// commits to closing instead of springing back open.
const DISMISS_THRESHOLD = 0.25;
const DISMISS_VELOCITY = 800;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Fraction of screen height the sheet opens to. Defaults to 0.8. */
  heightPercent?: number;
  /** Handle bar color class. Defaults to a neutral gray (bg-ink-emphasis/20)
   *  that reads on plain content — pass e.g. "bg-white" when content starts
   *  with a photo instead. */
  handleClassName?: string;
};

// Generic slide-up sheet — drag the handle down (or tap the backdrop) to
// dismiss. What renders inside is entirely up to the caller.
export function BottomSheet({
  visible,
  onClose,
  children,
  heightPercent = 0.8,
  handleClassName = "bg-ink-emphasis/20",
}: BottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetHeight = screenHeight * heightPercent;

  const translateY = useSharedValue(sheetHeight);
  const [modalVisible, setModalVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      translateY.value = withTiming(0, { duration: 340 });
    } else {
      translateY.value = withTiming(sheetHeight, { duration: 220 }, (finished) => {
        if (finished) scheduleOnRN(setModalVisible, false);
      });
    }
    // sheetHeight only changes on rotation/resize, not worth re-triggering for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startY = useSharedValue(0);
  const dragGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, startY.value + e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > sheetHeight * DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        translateY.value = withTiming(0, { duration: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, sheetHeight], [1, 0], Extrapolation.CLAMP),
  }));

  if (!modalVisible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View style={backdropStyle} className="absolute inset-0 bg-ink-emphasis/50">
          <Pressable className="flex-1" onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[{ height: sheetHeight }, sheetStyle]}
          className="rounded-t-3xl bg-white overflow-hidden"
        >
          <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
            {children}
          </View>

          {/* Overlays whatever renders at the top of children (e.g. a hero
              photo) instead of reserving its own bar — present on every
              BottomSheet, not just ones with a photo up top. */}
          <GestureDetector gesture={dragGesture}>
            <View className="absolute left-0 right-0 top-0 items-center pt-3" style={{ height: 100 }}>
              <View className={`h-1.5 w-24 rounded-full ${handleClassName}`} />
            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}
