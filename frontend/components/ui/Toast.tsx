import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image, type ImageProps } from "expo-image";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTO_HIDE_MS = 3500;

const toneClass = {
  success: "bg-primary",
  error: "bg-like",
} as const;

export type ToastState = {
  id: number;
  message: string;
  tone: keyof typeof toneClass;
  /** Small thumbnail on the left (e.g. the meal that was just saved). */
  image?: ImageProps["source"];
  /** A button on the right (e.g. "See it now" -> Profile). */
  action?: { label: string; onPress: () => void };
};

type ToastProps = {
  toast: ToastState | null;
  onHide: () => void;
};

// Short-lived message pinned near the top of the screen; hides itself after
// 3.5s. Pass a new `id` to restart the timer for a repeated message. Render
// it last inside a screen so it sits above everything else. Optional
// thumbnail and action button (the action also hides the toast).
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
      // Touchable only when there's a button to press.
      pointerEvents={toast.action ? "box-none" : "none"}
      className={`absolute left-5 right-5 flex-row items-center gap-3 rounded-2xl px-4 py-3 ${toneClass[toast.tone]}`}
      style={{ top: insets.top + 12 }}
    >
      {toast.image != null && (
        <Image source={toast.image} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
      )}
      <Text className="flex-1 font-inter-medium text-body text-white">{toast.message}</Text>
      {toast.action && (
        <View>
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              onHide();
            }}
            hitSlop={6}
            className="rounded-md border border-white/70 px-2 py-1"
          >
            <Text className="font-inter-semibold text-small text-white">{toast.action.label}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
