import { ReactNode, useEffect, useState } from "react";
import { View, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import { AppText } from "./AppText";
import { Spinner } from "./Spinner";

// "social" is a neutral white/bordered button for third-party auth
// (Google, Apple) — the icon carries the brand identity, not our palette.
// "tinted" is a soft, low-emphasis fill (e.g. a meal card's "View Details").
// "muted" is a generic neutral white/bordered button (e.g. an icon-only
// filter trigger) — same treatment as "social" but not scoped to auth.
type Variant = "primary" | "secondary" | "outline" | "social" | "tinted" | "muted";
// "default" spans its parent's width (e.g. a carousel's bottom CTA).
// "pill" hugs its content and pushes to the left edge of its parent
// (align-self: flex-start gives both at once) — e.g. a corner "Get Started".
// "circle" is a fixed-size icon-only button (e.g. a carousel's next arrow).
// "fullPill" spans its parent's width like "default" but fully rounded.
type Shape = "default" | "pill" | "circle" | "fullPill";

const containerClasses: Record<Variant, string> = {
  primary: "bg-primary active:opacity-80",
  secondary: "bg-accent active:opacity-80",
  outline: "bg-transparent border border-primary active:bg-primary/5",
  social: "bg-white border border-ink-emphasis/10 active:bg-ink-emphasis/5",
  tinted: "bg-tinted-bg active:opacity-80",
  muted: "bg-white border border-ink-emphasis/10 active:bg-ink-emphasis/5",
};

const labelClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  social: "text-ink",
  // 14px + light weight, overriding the "title" AppText variant's default
  // subheading/semibold (last class wins on a shared property).
  tinted: "text-primary text-body font-inter-light",
  muted: "text-ink",
};

const shapeClasses: Record<Shape, string> = {
  default: "rounded-xl px-5 py-3.5",
  pill: "rounded-full self-start px-5 py-3.5",
  circle: "rounded-full w-14 h-14",
  // Radius set via inline style (10px isn't on Tailwind's rounded-* scale).
  fullPill: "px-5 py-2",
};

const shapeStyles: Partial<Record<Shape, { borderRadius: number }>> = {
  fullPill: { borderRadius: 10 },
};

// Crossfade between the finished spiral and the label coming back.
const CONTENT_FADE_MS = 200;

type ButtonProps = Omit<PressableProps, "style"> & {
  label?: string;
  icon?: ReactNode;
  /** Which side of the label the icon renders on. Defaults to "left". */
  iconPosition?: "left" | "right";
  variant?: Variant;
  shape?: Shape;
  style?: StyleProp<ViewStyle>;
  /** Swaps the content for Spinner's rolling accent "wave" and blocks
   *  presses, without the disabled fade. The button keeps its size. When it
   *  flips back off, the wave curls into a spiral before the label returns. */
  loading?: boolean;
};

export function Button({
  label,
  icon,
  iconPosition = "left",
  variant = "primary",
  shape = "default",
  style,
  disabled,
  loading = false,
  ...props
}: ButtonProps) {
  // "fullPill" (currently only the "tinted" View Details button) centers its
  // label regardless of the icon, and pins the icon to the button's far edge.
  const isFullPill = shape === "fullPill";
  const labelNode = label && (
    <AppText variant="title" className={labelClasses[variant]}>
      {label}
    </AppText>
  );

  // The wave outlives `loading`: once it flips off, the wave curls into a
  // spiral first (Spinner's `done`), and only then goes away. Set during
  // render (not in an effect) so the wave is there on loading's first frame.
  const [showWave, setShowWave] = useState(loading);
  if (loading && !showWave) setShowWave(true);
  const busy = loading || showWave;

  const contentOpacity = useSharedValue(busy ? 0 : 1);
  useEffect(() => {
    contentOpacity.value = busy ? 0 : withTiming(1, { duration: CONTENT_FADE_MS });
  }, [busy, contentOpacity]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <Pressable
      className={`items-center justify-center ${containerClasses[variant]} ${shapeClasses[shape]} ${disabled ? "opacity-30" : ""}`}
      style={[shapeStyles[shape], style]}
      disabled={disabled || busy}
      accessibilityState={{ disabled: disabled || busy, busy }}
      {...props}
    >
      {/* Content stays mounted (just hidden) while busy so the button
          doesn't change size under the wave. */}
      <Animated.View className={isFullPill ? "w-full" : ""} style={contentStyle}>
        {isFullPill ? (
          <View className="w-full flex-row items-center">
            <View className="flex-1 items-start">{iconPosition === "left" && icon}</View>
            {labelNode}
            <View className="flex-1 items-end">{iconPosition === "right" && icon}</View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            {iconPosition === "left" && icon}
            {labelNode}
            {iconPosition === "right" && icon}
          </View>
        )}
      </Animated.View>
      {busy && (
        <Animated.View
          exiting={FadeOut.duration(CONTENT_FADE_MS)}
          pointerEvents="none"
          className="absolute inset-0 justify-center px-[50px]"
        >
          <Spinner variant="wave" size={12} color={colors.accent} done={!loading} onDone={() => setShowWave(false)} />
        </Animated.View>
      )}
    </Pressable>
  );
}
