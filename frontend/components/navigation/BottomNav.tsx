import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { House, Search, TrendingUp, Salad, Utensils } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type Tab = {
  href: "/home" | "/browse" | "/price-watch" | "/meal-planner";
  label: string;
  icon: LucideIcon;
};

const LEFT_TABS: Tab[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/browse", label: "Browse", icon: Search },
];

const RIGHT_TABS: Tab[] = [
  { href: "/price-watch", label: "Price Watch", icon: TrendingUp },
  { href: "/meal-planner", label: "Meal Planner", icon: Salad },
];

// Same spring as SegmentedSwitch's thumb, so the active pill pops in with
// the same small bounce as Home's By Budget / By Pantry switch.
const PILL_SPRING = { damping: 13, stiffness: 220, mass: 0.7 };
const PILL_FADE_MS = 120;

// Active tab: a soft rounded pill behind the icon (SegmentedSwitch's track
// color) plus a semibold primary label, so it's obvious at a glance, not
// just a color change. Inactive tabs use the switch's muted ink-subtle.
function TabButton({ href, label, icon: Icon }: Tab) {
  const active = usePathname() === href;
  const color = active ? colors.primary : colors.ink.subtle;
  const shown = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    shown.value = active ? withSpring(1, PILL_SPRING) : withTiming(0, { duration: PILL_FADE_MS });
  }, [active, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(shown.value, 1),
    transform: [{ scaleX: 0.5 + 0.5 * shown.value }],
  }));

  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="flex-1 items-center justify-center gap-1"
    >
      <View className="h-8 w-14 items-center justify-center">
        {/* Plain style on the Animated.View, className on the inner View:
            NativeWind can knock out Reanimated's animated values. */}
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }, pillStyle]}>
          <View className="flex-1 rounded-full border border-web-divider bg-web-divider/70" />
        </Animated.View>
        <Icon color={color} size={22} strokeWidth={active ? 2.4 : 2} />
      </View>
      <AppText variant="navLabel" className={active ? "font-inter-semibold text-primary" : "text-ink-subtle"}>
        {label}
      </AppText>
    </Pressable>
  );
}

// The featured tab: always shown filled/elevated rather than toggling
// active/inactive like the other four, since it's the app's primary action.
function DiscoverTabButton() {
  return (
    <Pressable
      onPress={() => router.navigate("/discover")}
      className="flex-1 items-center justify-center gap-1"
    >
      <View className="-mt-8 h-16 w-16 items-center justify-center rounded-full bg-primary shadow-sm">
        <Utensils color={colors.white} size={25} strokeWidth={2} />
      </View>
      <AppText variant="navLabel" className="text-primary">
        Discover
      </AppText>
    </Pressable>
  );
}

// Rendered as the Tabs navigator's custom tabBar (see app/(tabs)/_layout.tsx),
// so it stays mounted across tab switches instead of sliding with each
// screen's content. Owns its own bottom safe-area inset since it's no longer
// nested inside a screen's <Screen> (which only covers the "top" edge for
// tab screens).
export function BottomNav() {
  return (
    <SafeAreaView edges={["bottom"]} className="border-t border-ink-emphasis/10 bg-white">
      <View className="flex-row items-end justify-between px-6 pt-2 pb-1">
        {LEFT_TABS.map((tab) => (
          <TabButton key={tab.href} {...tab} />
        ))}
        <DiscoverTabButton />
        {RIGHT_TABS.map((tab) => (
          <TabButton key={tab.href} {...tab} />
        ))}
      </View>
    </SafeAreaView>
  );
}
