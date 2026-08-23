import { Tabs } from "expo-router";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, animation: "shift" }}
      tabBar={() => <BottomNav />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="price-watch" />
      <Tabs.Screen name="meal-planner" />
    </Tabs>
  );
}
