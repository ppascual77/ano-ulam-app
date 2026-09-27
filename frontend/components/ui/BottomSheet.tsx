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
  /** Fires once the close animation has actually finished and the native
   *  Modal has unmounted — NOT the same moment `visible` flips false. Use
   *  this (not a timeout) to open a second sheet right after this one
   *  closes: two RN `Modal`s presented at once, even briefly, can leave an
   *  orphaned full-screen overlay that blocks all touches underneath. */
  onClosed?: () => void;
  /** Extra layer rendered above everything (backdrop, panel, handle) —
   *  inside THIS sheet's own Modal, not a second one. React Native doesn't
   *  reliably support two native Modals stacking at once (a second
   *  present() call can silently no-op while the first is still showing),
   *  so anything that needs to visually sit on top of an open sheet — a
   *  celebratory confetti burst, say — has to live in here instead.
   *  pointerEvents="box-none" by default, so it's invisible to touch unless
   *  the content passed in opts back into it itself. */
  overlay?: ReactNode;
};

// Generic slide-up sheet — drag the handle down (or tap the backdrop) to
// dismiss. What renders inside is entirely up to the caller.
export function BottomSheet({
  visible,
  onClose,
  children,
  heightPercent = 0.8,
  handleClassName = "bg-ink-emphasis/20",
  onClosed,
  overlay,
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
        if (finished) {
          scheduleOnRN(setModalVisible, false);
          if (onClosed) scheduleOnRN(onClosed);
        }
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
              BottomSheet, not just ones with a photo up top. The outer
              layer is pointerEvents="box-none" (invisible to touch itself)
              so only the inner, narrower GestureDetector actually catches
              drag gestures — previously this spanned the FULL width at
              height 100, which sat on top of (and completely blocked) any
              top-corner buttons content rendered there, like a meal detail
              sheet's Back/Edit actions. */}
          <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 items-center" style={{ height: 100 }}>
            <GestureDetector gesture={dragGesture}>
              <View className="items-center pt-3" style={{ width: 160, height: 56 }}>
                <View className={`h-1.5 w-24 rounded-full ${handleClassName}`} />
              </View>
            </GestureDetector>
          </View>
        </Animated.View>

        {overlay && (
          <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 bottom-0">
            {overlay}
          </View>
        )}
      </View>
    </Modal>
  );
}
