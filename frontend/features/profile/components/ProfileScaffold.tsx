import { ReactNode, useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ProfileTabBar, type ProfileTab, type ProfileTabDef } from "./ProfileTabBar";
import { ProfileFooter } from "./ProfileFooter";

// How close to the bottom (px) counts as "near the end" (load more posts).
const LOAD_MORE_DISTANCE = 400;

type ProfileScaffoldProps = {
  /** Everything above the tabs (header, Community row, ...). */
  header: ReactNode;
  tabs: ProfileTabDef[];
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  /** Mini header name (see ProfileTabBar). */
  miniName?: string;
  /** Mini header "+" (own profile only). */
  onCreate?: () => void;
  /** Fires once each time the scroll gets near the bottom. */
  onNearEnd?: () => void;
  /** See ProfileTabBar's onTabRef (the first-run tour). */
  onTabRef?: (id: ProfileTab, view: View | null) => void;
  /** The active tab's content. */
  children: ReactNode;
};

// Shared body of every profile (own, someone else's, official): one scroll
// view with the header, a tab bar that sticks to the top once reached
// (with its mini header), the tab content, and the footer.
export function ProfileScaffold({ header, tabs, activeTab, onTabChange, miniName, onCreate, onNearEnd, onTabRef, children }: ProfileScaffoldProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [tabBarY, setTabBarY] = useState(0);
  const [stuck, setStuck] = useState(false);
  const nearEnd = useRef(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

      <View onLayout={(e) => setTabBarY(e.nativeEvent.layout.y)}>
        <ProfileTabBar tabs={tabs} active={activeTab} onChange={onTabChange} stuck={stuck} name={miniName} onCreate={onCreate} onTabRef={onTabRef} />
      </View>

      {/* At least most of a screen tall, so switching to a short tab
          doesn't yank the scroll position. */}
      <View className="px-5 pt-4" style={{ minHeight: windowHeight * 0.6 }}>
        {children}
      </View>

      <ProfileFooter />
    </ScrollView>
  );
}
