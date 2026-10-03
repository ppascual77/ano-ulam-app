import { Pressable, Text, View } from "react-native";

export type DiscoverTab = "recipes" | "community";

const TABS: { id: DiscoverTab; label: string }[] = [
  { id: "recipes", label: "Recipes" },
  { id: "community", label: "Community" },
];

// dark: over the Recipes reel photo. light: on the Community tab's white bg.
const variantClass = {
  dark: {
    active: { pill: "border-white/80", text: "text-white" },
    inactive: { pill: "border-transparent", text: "text-white/40" },
  },
  light: {
    active: { pill: "border-web-ink", text: "text-web-ink" },
    inactive: { pill: "border-transparent", text: "text-web-ink-soft" },
  },
} as const;

type FeedTabsProps = {
  active: DiscoverTab;
  onChange: (tab: DiscoverTab) => void;
  /** While the tab's content is loading. */
  disabled?: boolean;
  variant: keyof typeof variantClass;
};

export function FeedTabs({ active, onChange, disabled = false, variant }: FeedTabsProps) {
  return (
    <View className="flex-row gap-1">
      {TABS.map((tab) => {
        const tone = variantClass[variant][tab.id === active ? "active" : "inactive"];
        return (
          <Pressable
            key={tab.id}
            disabled={disabled}
            onPress={() => onChange(tab.id)}
            className={`rounded-full border px-4 py-1.5 ${tone.pill}`}
          >
            <Text className={`font-inter-semibold text-small ${tone.text}`}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
