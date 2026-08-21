import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { House, Search, TrendingUp, Salad, Utensils } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";

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

function TabButton({ href, label, icon: Icon }: Tab) {
  const active = usePathname() === href;
  const color = active ? colors.primary : colors.ink.normal;

  return (
    <Pressable
      onPress={() => router.push(href)}
      className="flex-1 items-center justify-center gap-1"
    >
      <Icon color={color} size={24} strokeWidth={2} />
      <AppText variant="navLabel" className={active ? "text-primary" : ""}>
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
      onPress={() => router.push("/discover")}
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

// Cancels Screen's default px-6 so the bar itself spans edge-to-edge; the
// inner row restores px-6 so tab content still lines up with screen content.
export function BottomNav() {
  return (
    <View className="-mx-6 border-t border-ink-emphasis/10 bg-white">
      <View className="flex-row items-end justify-between pt-2 pb-1">
        {LEFT_TABS.map((tab) => (
          <TabButton key={tab.href} {...tab} />
        ))}
        <DiscoverTabButton />
        {RIGHT_TABS.map((tab) => (
          <TabButton key={tab.href} {...tab} />
        ))}
      </View>
    </View>
  );
}
