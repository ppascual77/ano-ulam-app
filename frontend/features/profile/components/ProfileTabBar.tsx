import { type ReactNode, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Bookmark, ChefHat, ImageIcon, LayoutGrid, ShoppingCart, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

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

const MINI_HEADER_HEIGHT = 40;
const MINI_AVATAR = 24;
const EASE = Easing.out(Easing.cubic);
export const TAB_TIMING = { duration: 300, easing: EASE };
// Reduce motion: things still move, just quickly.
const TIMING_REDUCED = { duration: 120, easing: EASE };
// More tabs than this and only the active one keeps its label.
const FULL_LABELS_UP_TO = 3;

type Layout = { x: number; y: number; width: number; height: number };

type ProfileTabBarProps = {
  tabs: ProfileTabDef[];
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  /** True once the bar is pinned to the top: shows the mini header. */
  stuck: boolean;
  /** The mini header's name. */
  name?: string;
  /** The mini header's small avatar (given its size), before the name. */
  miniAvatar?: (size: number) => ReactNode;
};

// Sticky tab bar (the ScrollView's stickyHeaderIndices pins it). While
// pinned, a slim header with the profile's avatar and name opens above the
// tabs, so the big header reads as shrinking into it. A soft primary pill
// slides behind the active tab. With four tabs, only the active one shows
// its label: it widens while the others close to icons, on the pill's
// timing.
export function ProfileTabBar({ tabs, active, onChange, stuck, name, miniAvatar }: ProfileTabBarProps) {
  const reduceMotion = useReduceMotion();
  const compact = tabs.length > FULL_LABELS_UP_TO;
  const [layouts, setLayouts] = useState<Partial<Record<ProfileTab, Layout>>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillY = useSharedValue(0);
  const pillHeight = useSharedValue(0);
  const mini = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[active];
    if (!layout) return;
    // First measurement jumps into place; later changes slide.
    const timing = reduceMotion ? TIMING_REDUCED : TAB_TIMING;
    const animate = pillWidth.value > 0;
    pillX.value = animate ? withTiming(layout.x, timing) : layout.x;
    pillWidth.value = animate ? withTiming(layout.width, timing) : layout.width;
    pillY.value = layout.y;
    pillHeight.value = layout.height;
  }, [active, layouts, reduceMotion, pillX, pillWidth, pillY, pillHeight]);

  useEffect(() => {
    mini.value = withTiming(stuck ? 1 : 0, reduceMotion ? TIMING_REDUCED : TAB_TIMING);
  }, [stuck, reduceMotion, mini]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    top: pillY.value,
    width: pillWidth.value,
    height: pillHeight.value,
  }));
  const miniStyle = useAnimatedStyle(() => ({
    height: mini.value * MINI_HEADER_HEIGHT,
    opacity: mini.value,
  }));

  const select = (id: ProfileTab) => {
    if (id === active) return;
    void Haptics.selectionAsync();
    onChange(id);
  };

  // The widening tab and its neighbours glide to their new sizes.
  const tabLayout = compact && !reduceMotion ? LinearTransition.duration(TAB_TIMING.duration).easing(EASE) : undefined;

  return (
    <View className="bg-white">
      <Animated.View style={miniStyle} className="overflow-hidden">
        <View className="flex-row items-center gap-2 px-5 pt-3">
          {miniAvatar?.(MINI_AVATAR)}
          {!!name && (
            <Text numberOfLines={1} className="shrink font-inter-semibold text-body text-ink-emphasis">
              {name}
            </Text>
          )}
        </View>
      </Animated.View>

      <View accessibilityRole="tablist" className="flex-row border-b border-ink-emphasis/10 px-3 py-2">
        <Animated.View pointerEvents="none" style={pillStyle} className="absolute left-0 rounded-full bg-primary/10" />
        {tabs.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <Animated.View
              key={id}
              layout={tabLayout}
              className={!compact || isActive ? "flex-1" : ""}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                setLayouts((prev) => ({ ...prev, [id]: { x, y, width, height } }));
              }}
            >
              <Pressable
                onPress={() => select(id)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                className="flex-row items-center justify-center gap-1.5 px-4 py-2"
              >
                <Icon color={isActive ? colors.primary : colors.ink.subtle} size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                {compact ? (
                  isActive && (
                    <Animated.Text
                      entering={FadeIn.delay(reduceMotion ? 0 : 90).duration(200)}
                      exiting={FadeOut.duration(100)}
                      numberOfLines={1}
                      className="font-inter-semibold text-body text-primary"
                    >
                      {label}
                    </Animated.Text>
                  )
                ) : (
                  <Text
                    numberOfLines={1}
                    className={`text-body ${isActive ? "font-inter-semibold text-primary" : "font-inter-medium text-ink-subtle"}`}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
