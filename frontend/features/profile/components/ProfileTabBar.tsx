import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Bookmark, ChefHat, ImageIcon, LayoutGrid, Plus, ShoppingCart, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

export type ProfileTab = "saved" | "recipes" | "grocery" | "pantry" | "posts";
export type ProfileTabDef = { id: ProfileTab; label: string; Icon: LucideIcon };

const SAVED: ProfileTabDef = { id: "saved", label: "Saved", Icon: Bookmark };
const CREATED: ProfileTabDef = { id: "recipes", label: "Created", Icon: LayoutGrid };

// Own profile: all four. Someone else's: Saved + Created. Official:
// Recipes + Posts.
export const OWN_TABS: ProfileTabDef[] = [
  SAVED,
  CREATED,
  { id: "grocery", label: "Grocery", Icon: ShoppingCart },
  { id: "pantry", label: "Pantry", Icon: ChefHat },
];
export const VISITOR_TABS: ProfileTabDef[] = [SAVED, CREATED];
export const OFFICIAL_TABS: ProfileTabDef[] = [
  { id: "recipes", label: "Recipes", Icon: LayoutGrid },
  { id: "posts", label: "Posts", Icon: ImageIcon },
];

const MINI_HEADER_HEIGHT = 32;
const TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };

type ProfileTabBarProps = {
  tabs: ProfileTabDef[];
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  /** True once the bar is pinned to the top: shows the mini header. */
  stuck: boolean;
  /** Shown after "AnoUlam" in the mini header (omitted on the official
   *  profile, where it would repeat). */
  name?: string;
  /** Owner only: the mini header's "+" (opens Create). */
  onCreate?: () => void;
};

// Sticky tab bar (the ScrollView's stickyHeaderIndices pins it). While
// pinned, a mini "AnoUlam · name" header slides open above the tabs. The
// green indicator slides to the active tab, measured with onLayout.
export function ProfileTabBar({ tabs, active, onChange, stuck, name, onCreate }: ProfileTabBarProps) {
  const [layouts, setLayouts] = useState<Partial<Record<ProfileTab, { x: number; width: number }>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const mini = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[active];
    if (!layout) return;
    // First measurement jumps into place; later tab changes slide.
    const animate = indicatorWidth.value > 0;
    indicatorX.value = animate ? withTiming(layout.x, TIMING) : layout.x;
    indicatorWidth.value = animate ? withTiming(layout.width, TIMING) : layout.width;
  }, [active, layouts, indicatorX, indicatorWidth]);

  useEffect(() => {
    mini.value = withTiming(stuck ? 1 : 0, TIMING);
  }, [stuck, mini]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));
  const miniStyle = useAnimatedStyle(() => ({
    height: mini.value * MINI_HEADER_HEIGHT,
    opacity: mini.value,
  }));

  return (
    <View className="bg-white">
      <Animated.View style={miniStyle} className="overflow-hidden">
        <View className="flex-row items-center justify-between px-5 pt-2">
          <View className="shrink flex-row items-center gap-1.5">
            <Text className="font-inter-bold text-body text-brand-green">AnoUlam</Text>
            {!!name && (
              <Text numberOfLines={1} className="shrink font-inter-regular text-body text-web-ink-muted">
                {name}
              </Text>
            )}
          </View>
          {onCreate && (
            <Pressable onPress={onCreate} hitSlop={8} accessibilityLabel="Create">
              <Plus color={colors.webInk.soft} size={22} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      <View className="flex-row border-b border-web-divider">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = id === active;
          const color = isActive ? colors.brandGreen.DEFAULT : colors.webInk.muted;
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setLayouts((prev) => ({ ...prev, [id]: { x, width } }));
              }}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
            >
              <Icon color={color} size={16} />
              <Text className={`font-inter-medium text-body ${isActive ? "text-brand-green" : "text-web-ink-muted"}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        <Animated.View style={indicatorStyle} className="absolute bottom-0 left-0 h-0.5 bg-brand-green" />
      </View>
    </View>
  );
}
