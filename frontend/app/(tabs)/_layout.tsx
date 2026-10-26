import { Tabs } from "expo-router";
import { BottomNav } from "@/frontend/components/navigation/BottomNav";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

export default function TabsLayout() {
  // Reduce motion: tabs crossfade instead of sliding across.
  const reduceMotion = useReduceMotion();
  return (
    // With the "shift" animation, the defaults (detach off-screen tabs,
    // mount each tab on first visit) intermittently showed a blank white
    // page, or flashed the previous tab before the new one rendered: the
    // detach/attach and first mount can land mid-animation. Keeping tabs
    // attached and pre-mounted gives the slide real content on both sides.
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        animation: reduceMotion ? "fade" : "shift",
        // The stock fade only animates opacity. Switching from "shift" to it
        // (turning Reduce motion on) left each inactive tab stuck at shift's
        // last translateX (-50 / +50): Home showed cut off on the left with a
        // gap on the right. A plain `translateX: 0` doesn't clear it: shift
        // runs on the native driver, so JS still thinks the value is 0 and
        // React never sends the "change". A native-driven interpolation that
        // always outputs 0 does: attaching it sets the view natively.
        ...(reduceMotion && {
          sceneStyleInterpolator: ({ current }) => ({
            sceneStyle: {
              opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, 0] }) }],
            },
          }),
        }),
      }}
      tabBar={() => <BottomNav />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="browse" />
      {/* Black behind Discover's dark reel, so the tab never flashes the
          default white background while it mounts or slides in. */}
      <Tabs.Screen name="discover" options={{ sceneStyle: { backgroundColor: colors.black } }} />
      <Tabs.Screen name="price-watch" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
