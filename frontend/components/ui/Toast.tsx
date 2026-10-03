import { useEffect } from "react";
import { Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTO_HIDE_MS = 3500;

const toneClass = {
  success: "bg-primary",
  error: "bg-like",
} as const;

export type ToastState = { id: number; message: string; tone: keyof typeof toneClass };

type ToastProps = {
  toast: ToastState | null;
  onHide: () => void;
};

// Short-lived message pinned near the top of the screen; hides itself after
// 3.5s. Pass a new `id` to restart the timer for a repeated message. Render
// it last inside a screen so it sits above everything else.
export function Toast({ toast, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onHide, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
    // Keyed on the toast's id only: a new toast restarts the timer.
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.id}
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      className={`absolute left-5 right-5 rounded-2xl px-4 py-3 ${toneClass[toast.tone]}`}
      style={{ top: insets.top + 12 }}
    >
      <Text className="font-inter-medium text-body text-white">{toast.message}</Text>
    </Animated.View>
  );
}
