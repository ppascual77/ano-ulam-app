import { ReactNode, useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { FadeIn, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProfileTabBar, TAB_TIMING, type ProfileTab, type ProfileTabDef } from "./ProfileTabBar";

// How close to the bottom (px) counts as "near the end" (load more posts).
const LOAD_MORE_DISTANCE = 400;
// A new tab's content slides in this far from the side of the tab picked.
const CONTENT_SLIDE = 12;

type ProfileScaffoldProps = {
  /** Everything above the tabs (header, Community row, ...). */
  header: ReactNode;
  tabs: ProfileTabDef[];
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  /** Mini header name and avatar (see ProfileTabBar). */
  miniName?: string;
  miniAvatar?: (size: number) => ReactNode;
  /** Fires once each time the scroll gets near the bottom. */
  onNearEnd?: () => void;
  /** Every scroll event (header effects, status bar strip). */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The page runs under the status bar (Profile's green header): the tab
   *  bar pins this far down, below it, instead of at the very top. */
  stickyTop?: number;
  /** The active tab's content. */
  children: ReactNode;
};

// One tab's content coming in: a short slide from the side of the tab
// picked, with a fade.
function slideIn(dx: number) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateX: dx }] },
      animations: {
        opacity: withTiming(1, TAB_TIMING),
        transform: [{ translateX: withTiming(0, TAB_TIMING) }],
      },
    };
  };
}

// Shared body of every profile (own, someone else's, official): one scroll
// view with the header, a tab bar that sticks to the top once reached
// (with its mini header), and the tab content.
export function ProfileScaffold({
  header,
  tabs,
  activeTab,
  onTabChange,
  miniName,
  miniAvatar,
  onNearEnd,
  onScroll: onScrollProp,
  stickyTop = 0,
  children,
}: ProfileScaffoldProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [tabBarY, setTabBarY] = useState(0);
  const [stuck, setStuck] = useState(false);
  const nearEnd = useRef(false);

  // Which way the content slides: from the right for a tab further along.
  // (Set during render, React's pattern for tracking the previous value.)
  const [shown, setShown] = useState({ tab: activeTab, direction: 0 });
  if (shown.tab !== activeTab) {
    const ids = tabs.map((t) => t.id);
    setShown({ tab: activeTab, direction: Math.sign(ids.indexOf(activeTab) - ids.indexOf(shown.tab)) });
  }
  // Nothing on first show; Reduce motion: the fade only.
  const entering =
    shown.direction === 0 ? undefined : reduceMotion ? FadeIn.duration(200) : slideIn(shown.direction * CONTENT_SLIDE);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScrollProp?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const nextStuck = tabBarY > 0 && contentOffset.y >= tabBarY;
    if (nextStuck !== stuck) setStuck(nextStuck);
    // Once per arrival near the bottom, not on every scroll event.
    const isNearEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height) < LOAD_MORE_DISTANCE;
    if (isNearEnd && !nearEnd.current) onNearEnd?.();
    nearEnd.current = isNearEnd;
  };

  return (
    <ScrollView
      stickyHeaderIndices={[1]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <View className="pb-4">{header}</View>

      {/* With stickyTop, the sticky part reaches that far up over the
          header (see-through, letting touches through), so it pins just
          below the status bar while the tabs sit where they always do. */}
      <View
        onLayout={(e) => setTabBarY(e.nativeEvent.layout.y)}
        pointerEvents="box-none"
        style={stickyTop ? { marginTop: -stickyTop, paddingTop: stickyTop } : undefined}
      >
        <ProfileTabBar tabs={tabs} active={activeTab} onChange={onTabChange} stuck={stuck} name={miniName} miniAvatar={miniAvatar} />
      </View>

      {/* At least most of a screen tall, so switching to a short tab
          doesn't yank the scroll position. */}
      {/* Bottom padding clears the home indicator (top-only safe area). */}
      <View className="px-5 pt-4" style={{ minHeight: windowHeight * 0.6, paddingBottom: insets.bottom + 40 }}>
        <Animated.View key={activeTab} entering={entering}>
          {children}
        </Animated.View>
      </View>
    </ScrollView>
  );
}
