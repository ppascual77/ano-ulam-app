import { Tabs } from "expo-router";
import { BottomNav } from "@/frontend/components/navigation/BottomNav";
import { colors } from "@/frontend/constants/theme";

export default function TabsLayout() {
  return (
    // With the "shift" animation, the defaults (detach off-screen tabs,
    // mount each tab on first visit) intermittently showed a blank white
    // page, or flashed the previous tab before the new one rendered: the
    // detach/attach and first mount can land mid-animation. Keeping tabs
    // attached and pre-mounted gives the slide real content on both sides.
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{ headerShown: false, animation: "shift", lazy: false }}
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
