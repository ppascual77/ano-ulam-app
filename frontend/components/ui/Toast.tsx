import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image, type ImageProps } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, FadeOutUp, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

const AUTO_HIDE_MS = 3500;
// Slides down 12px into place on a plain ease-out (no spring, no
// overshoot), driven by our own timing rather than an entering preset.
// Leaves upward a little quicker.
const ENTER_MS = 220;
const ENTER_OFFSET = 12;
const EXIT = FadeOutUp.duration(180);
// An upward flick past this (or fast enough) dismisses it.
const DISMISS_DISTANCE = 24;
const DISMISS_VELOCITY = 500;

// The tone only colors the small icon (or the badge on a thumbnail); the
// surface stays white, so a toast reads as part of the app, not an alarm.
const TONES = {
  success: { Icon: CircleCheck, color: colors.primary, tileClassName: "bg-primary/10" },
  error: { Icon: CircleAlert, color: colors.like, tileClassName: "bg-like/10" },
} as const;

export type ToastState = {
  id: number;
  message: string;
  tone: keyof typeof TONES;
  /** Small thumbnail on the left (e.g. the meal that was just saved). */
  image?: ImageProps["source"];
  /** A text button on the right (e.g. "View" -> Profile). */
  action?: { label: string; onPress: () => void };
};

type ToastProps = {
  toast: ToastState | null;
  onHide: () => void;
};

// Short-lived message floating near the top of the screen: a white pill
// that hugs its content, with the tone as a small icon (or as a badge on
// the thumbnail). Hides itself after 3.5s, or swipe it up. Pass a new `id`
// to restart the timer for a repeated message. Render it last inside a
// screen so it sits above everything else. The action also hides it.
export function Toast({ toast, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const dragY = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!toast) return;
    dragY.value = 0;
    shown.value = 0;
    shown.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onHide, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
    // Keyed on the toast's id only: a new toast restarts the timer.
  }, [toast?.id]);

  // Follows the finger upward (resists going down), and flicks away.
  const swipe = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate((e) => {
      dragY.value = e.translationY < 0 ? e.translationY : e.translationY * 0.2;
    })
    .onEnd((e) => {
      if (-e.translationY > DISMISS_DISTANCE || -e.velocityY > DISMISS_VELOCITY) scheduleOnRN(onHide);
      else dragY.value = withTiming(0, { duration: 180 });
    });
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value - (1 - shown.value) * ENTER_OFFSET }],
    opacity: shown.value * (1 + Math.min(dragY.value, 0) / 80),
  }));

  if (!toast) return null;
  const tone = TONES[toast.tone];

  return (
    <Animated.View
      key={toast.id}
      exiting={EXIT}
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center px-4"
      style={{ top: insets.top + 8 }}
    >
      <GestureDetector gesture={swipe}>
        {/* Plain style on the Animated.View, className on the inner View:
            NativeWind can knock out Reanimated's animated values. */}
        <Animated.View style={[{ maxWidth: "100%" }, dragStyle]}>
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="flex-row items-center gap-3 rounded-2xl border border-ink-emphasis/10 bg-white py-2 pl-2 pr-4 shadow-lg"
          >
            {toast.image != null ? (
              <View>
                <Image source={toast.image} style={{ width: 36, height: 36, borderRadius: 10 }} contentFit="cover" />
                <View className="absolute -bottom-1 -right-1 rounded-full bg-white">
                  <tone.Icon color={tone.color} fill={colors.white} size={16} strokeWidth={2.5} />
                </View>
              </View>
            ) : (
              <View className={`h-9 w-9 items-center justify-center rounded-xl ${tone.tileClassName}`}>
                <tone.Icon color={tone.color} size={18} strokeWidth={2.25} />
              </View>
            )}

            <Text className="shrink font-inter-medium text-body text-ink-emphasis">{toast.message}</Text>

            {toast.action && (
              <>
                <View className="h-5 w-px bg-ink-emphasis/10" />
                <Pressable
                  onPress={() => {
                    toast.action?.onPress();
                    onHide();
                  }}
                  hitSlop={10}
                  className="active:opacity-60"
                >
                  <Text className="font-inter-semibold text-body text-primary">{toast.action.label}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
