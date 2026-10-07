import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// The "selected" pill behind a tab: a soft rounded pill (SegmentedSwitch's
// track color) that springs in with a small bounce when `active` turns on and
// fades out quickly when it turns off. Same motion as the Bottom Nav's tabs.
// Fills its parent (absolutely positioned), so put it first inside the tab
// and the tab's content after it.

// Same spring as SegmentedSwitch's thumb.
const PILL_SPRING = { damping: 13, stiffness: 220, mass: 0.7 };
const PILL_FADE_MS = 120;
const FILL = { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 } as const;
const UNDERLINE = { position: "absolute", bottom: 0, left: 12, right: 12, height: 2, borderRadius: 1, backgroundColor: colors.primary } as const;

type ActivePillProps = {
  active: boolean;
  /** Adds a straight primary-colored line along the pill's bottom, for tabs
   *  that need a stronger selected state (e.g. Home's pantry tabs). */
  bottomBorder?: boolean;
};

export function ActivePill({ active, bottomBorder = false }: ActivePillProps) {
  const shown = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    shown.value = active ? withSpring(1, PILL_SPRING) : withTiming(0, { duration: PILL_FADE_MS });
  }, [active, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(shown.value, 1),
    transform: [{ scaleX: 0.5 + 0.5 * shown.value }],
  }));

  // Plain style on the Animated.View, className on the inner View: NativeWind
  // can knock out Reanimated's animated values.
  return (
    <Animated.View pointerEvents="none" style={[FILL, pillStyle]}>
      <View className="flex-1 rounded-full border border-web-divider bg-web-divider/70" />
      {/* A straight line (not a border, which would curve with the rounded
          pill), inset from the rounded ends so it sits flat along the base. */}
      {bottomBorder && <View style={UNDERLINE} />}
    </Animated.View>
  );
}
