import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { ActivePill } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { PantryIngredient } from "../mock/api";
import { usePantryGroups } from "../hooks/usePantryMatches";
import { PANTRY_GROUPS, type PantryGroup } from "../pantryGroups";

type Tab = "all" | PantryGroup;

// Selected state: the shared ActivePill (Bottom Nav's springy soft pill)
// with a primary bottom border, and the label + count in primary.
function TabButton({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} className="px-3 py-1.5">
      <ActivePill active={selected} bottomBorder />
      <View className="flex-row items-center gap-1.5">
        <Text className={`text-body ${selected ? "font-inter-semibold text-primary" : "font-inter-medium text-ink-subtle"}`}>{label}</Text>
        <View className={`rounded-full px-1.5 py-0.5 ${selected ? "bg-primary/10" : "bg-ink-emphasis/10"}`}>
          <Text className={`font-inter-semibold text-sub ${selected ? "text-primary" : "text-ink-subtle"}`}>{count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// The pantry as tabs (All + a tab per group that has something, each with a
// count) over colored chips, tinted by group, with a remove button. Chips
// just fade in/out (no movement), so only the tab pill bounces.
export function PantryIngredientTabs({ pantry, onRemove }: { pantry: PantryIngredient[]; onRemove: (id: string) => void }) {
  const groupOf = usePantryGroups(pantry);
  const [tab, setTab] = useState<Tab>("all");

  const counts = useMemo(() => {
    const c = new Map<PantryGroup, number>();
    for (const item of pantry) {
      const g = groupOf.get(item.id) ?? "staples";
      c.set(g, (c.get(g) ?? 0) + 1);
    }
    return c;
  }, [pantry, groupOf]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: pantry.length },
    ...PANTRY_GROUPS.filter((g) => (counts.get(g.key) ?? 0) > 0).map((g) => ({ key: g.key, label: g.label, count: counts.get(g.key)! })),
  ];
  // A tab that just emptied (its last item removed) falls back to All.
  const activeTab: Tab = tabs.some((t) => t.key === tab) ? tab : "all";
  const shown = activeTab === "all" ? pantry : pantry.filter((p) => (groupOf.get(p.id) ?? "staples") === activeTab);
  const chipClass = (id: string) => PANTRY_GROUPS.find((g) => g.key === (groupOf.get(id) ?? "staples"))!.chipClass;

  return (
    <View className="gap-3">
      {/* pl-1.5 / pr-2: room for the pill's spring overshoot, which would
          otherwise get clipped at the row's edges (the first tab's left side). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 pl-1.5 pr-2">
        {tabs.map((t) => (
          <TabButton key={t.key} label={t.label} count={t.count} selected={t.key === activeTab} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {/* Soft rule between the tab controls and the chips, so the two rows of
          rounded shapes don't read as one list of data. */}
      <View className="h-px bg-ink-emphasis/10" />

      <View className="flex-row flex-wrap gap-2">
        {shown.map((item) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(140)}
          >
            <View className={`flex-row items-center gap-2 rounded-full px-3.5 py-2 ${chipClass(item.id)}`}>
              <Text className="font-inter-medium text-body text-ink-emphasis">{item.name}</Text>
              <Pressable onPress={() => onRemove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.name}`}>
                <X color={colors.ink.emphasis} size={13} />
              </Pressable>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
