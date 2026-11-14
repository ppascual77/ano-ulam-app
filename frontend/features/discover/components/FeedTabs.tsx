import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Users, Utensils, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

export type DiscoverTab = "recipes" | "community";

const TABS: { id: DiscoverTab; label: string; Icon: LucideIcon }[] = [
  { id: "recipes", label: "Recipes", Icon: Utensils },
  { id: "community", label: "Community", Icon: Users },
];

const LIQUID_GLASS = isLiquidGlassAvailable();
/** The tabs capsule's height (Discover's + matches it, so they line up). */
export const FEED_TABS_HEIGHT = 40;
const HEIGHT = FEED_TABS_HEIGHT;
// The thumb sits this far inside the capsule.
const INSET = 3;
const CAPSULE = { borderRadius: HEIGHT / 2 };
const THUMB_SPRING = { damping: 16, stiffness: 220, mass: 0.7 };

// dark: over the Recipes reel photo (clear glass). light: on Community,
// with posts scrolling past under it (white glass). The selected tab is always a white thumb
// with dark text, so it reads at a glance on either.
const variants = {
  dark: {
    track: LIQUID_GLASS ? "border border-white/25" : Platform.OS === "ios" ? "border border-white/25 bg-black/20" : "border border-white/25 bg-black/45",
    inactiveText: "text-white/85",
    inactiveIcon: "rgba(255,255,255,0.85)",
  },
  // White glass: Community's posts scroll past under it, so it has to
  // read over photos too.
  light: {
    track: LIQUID_GLASS
      ? "border border-ink-emphasis/10 bg-white/40"
      : Platform.OS === "ios"
        ? "border border-ink-emphasis/10 bg-white/70"
        : "border border-ink-emphasis/10 bg-white/95",
    inactiveText: "text-ink-subtle",
    inactiveIcon: colors.ink.subtle,
  },
} as const;

type FeedTabsProps = {
  active: DiscoverTab;
  onChange: (tab: DiscoverTab) => void;
  /** While the tab's content is loading. */
  disabled?: boolean;
  variant: keyof typeof variants;
};

// Discover's Recipes / Community switch: one capsule (liquid glass over the
// reel, a grey track on Community) with a white thumb sliding to the chosen
// tab on a soft spring, each tab with a small icon.
export function FeedTabs({ active, onChange, disabled = false, variant }: FeedTabsProps) {
  const reduceMotion = useReduceMotion();
  const tone = variants[variant];
  // Each tab's measured width; the thumb's position and size follow them.
  const [widths, setWidths] = useState<number[]>(() => TABS.map(() => 0));
  const activeIndex = TABS.findIndex((t) => t.id === active);
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);

  useEffect(() => {
    if (widths.some((w) => w === 0)) return;
    const x = widths.slice(0, activeIndex).reduce((sum, w) => sum + w, 0);
    const w = widths[activeIndex];
    const animate = (to: number) => (reduceMotion ? withTiming(to, { duration: 160 }) : withSpring(to, THUMB_SPRING));
    // Snap on the first measure, animate after.
    if (thumbW.value === 0) {
      thumbX.value = x;
      thumbW.value = w;
    } else {
      thumbX.value = animate(x);
      thumbW.value = animate(w);
    }
  }, [activeIndex, widths, reduceMotion]);

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: thumbW.value > 0 ? 1 : 0,
    width: thumbW.value,
    transform: [{ translateX: thumbX.value }],
  }));

  return (
    <View style={[{ height: HEIGHT, padding: INSET }, CAPSULE]} className={`flex-row overflow-hidden ${tone.track}`}>
      {LIQUID_GLASS && <GlassView glassEffectStyle={variant === "dark" ? "clear" : "regular"} style={[StyleSheet.absoluteFill, CAPSULE]} />}
      {!LIQUID_GLASS && Platform.OS === "ios" && (
        <BlurView intensity={25} tint={variant === "dark" ? "dark" : "light"} pointerEvents="none" style={[StyleSheet.absoluteFill, CAPSULE]} />
      )}

      {/* The white thumb behind the chosen tab. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: INSET, bottom: INSET, left: INSET, borderRadius: (HEIGHT - INSET * 2) / 2, backgroundColor: colors.white, borderWidth: variant === "light" ? 1 : 0, borderColor: `${colors.ink.emphasis}14` }, thumbStyle]}
      />

      {TABS.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            disabled={disabled}
            onPress={() => onChange(tab.id)}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              setWidths((prev) => (prev[i] === w ? prev : prev.map((old, k) => (k === i ? w : old))));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-row items-center gap-1.5 px-4"
          >
            <tab.Icon color={selected ? colors.ink.emphasis : tone.inactiveIcon} size={14} strokeWidth={2.4} />
            {/* Android measures bold Inter a hair narrower than it draws it
                with its default "high quality" line breaking, clipping the
                last letter ("Communit"): measured the simple way, plus a
                hair of room at the end. */}
            <Text
              textBreakStrategy="simple"
              numberOfLines={1}
              className={`pr-0.5 font-inter-bold text-small ${selected ? "text-ink-emphasis" : tone.inactiveText}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
