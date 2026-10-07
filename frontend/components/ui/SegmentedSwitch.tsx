import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// Pick-one switch: a soft track with a white thumb that slides (springy)
// under the selected option, stretching to that option's width. E.g. Home's
// By Budget / By Pantry, the meal page's All N / Per serving.
// No conditional shadow-* class (toggling one crashed NativeWind with
// "Couldn't find a navigation context"); the raised look is bg + border.

// Lightly underdamped: the thumb overshoots its target a little and settles
// back, a small bounce when switching tabs.
const THUMB_SPRING = { damping: 13, stiffness: 220, mass: 0.7 };
// The thumb's fixed look (same as rounded-full border border-web-divider
// bg-white inset by the track's p-1). Width and x are animated.
const THUMB_BASE = {
  position: "absolute",
  top: 4,
  bottom: 4,
  left: 4,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.webDivider,
  backgroundColor: colors.white,
} as const;

type SegmentedSwitchOption<T extends string> = { value: T; label: string };

// Label size + padding per size. The thumb measures the options, so it
// fits whichever size is used.
const SIZES = {
  sm: { option: "px-3 py-1.5", text: "text-small" },
  md: { option: "px-4 py-2", text: "text-body" },
  lg: { option: "px-5 py-2.5", text: "text-body-lg" },
} as const;

type SegmentedSwitchProps<T extends string> = {
  options: SegmentedSwitchOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Defaults to "sm" (compact, e.g. beside a section title). */
  size?: keyof typeof SIZES;
};

export function SegmentedSwitch<T extends string>({ options, value, onChange, size = "sm" }: SegmentedSwitchProps<T>) {
  const sizing = SIZES[size];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  // Each option's measured width; the thumb's position and size come from
  // these, so labels of different lengths are fine.
  const [widths, setWidths] = useState<number[]>(() => options.map(() => 0));
  const position = useSharedValue(selectedIndex);

  useEffect(() => {
    position.value = withSpring(selectedIndex, THUMB_SPRING);
  }, [selectedIndex]);

  const thumbStyle = useAnimatedStyle(() => {
    // Mid-slide between two neighboring options: blend their offsets and
    // widths. `t` isn't clamped, so the spring's overshoot carries the thumb
    // a little past the end option and back (the bounce); its width is
    // clamped so it never shrinks or bloats while doing so.
    const last = widths.length - 1;
    const i = Math.min(Math.max(Math.floor(position.value), 0), Math.max(last - 1, 0));
    const j = Math.min(i + 1, last);
    const t = position.value - i;
    let offsetI = 0;
    for (let k = 0; k < i; k++) offsetI += widths[k];
    const offsetJ = offsetI + (j > i ? widths[i] : 0);
    const width = widths[i] + (widths[j] - widths[i]) * t;
    return {
      opacity: widths.every((w) => w > 0) ? 1 : 0,
      width: Math.min(Math.max(width, Math.min(widths[i], widths[j])), Math.max(widths[i], widths[j])),
      transform: [{ translateX: offsetI + (offsetJ - offsetI) * t }],
    };
  }, [widths]);

  return (
    // overflow-hidden keeps the bouncing thumb inside the rounded track.
    <View className="flex-row self-start overflow-hidden rounded-full bg-web-divider/70 p-1" accessibilityRole="radiogroup">
      {/* Plain style, no className: NativeWind re-applies className styles
          on re-render and can knock out Reanimated's animated values. */}
      <Animated.View style={[THUMB_BASE, thumbStyle]} />
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              setWidths((prev) => (prev[index] === w ? prev : prev.map((p, k) => (k === index ? w : p))));
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`rounded-full ${sizing.option}`}
          >
            <Text className={`font-inter-semibold ${sizing.text} ${selected ? "text-primary" : "text-ink-subtle"}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
