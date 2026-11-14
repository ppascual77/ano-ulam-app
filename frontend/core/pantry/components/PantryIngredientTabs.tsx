import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { ActivePill } from "@/frontend/components/ui";
import type { PantryIngredient } from "../types";
import { usePantryGroups } from "../hooks/usePantryMatches";
import { PANTRY_GROUPS, type PantryGroup } from "../pantryGroups";
import { PantryChip } from "./PantryChip";

type Tab = "all" | PantryGroup;

// About two rows of chips before the rest fold behind "+N more".
const FOLD_AT = 8;

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
// count) over colored chips, tinted by group, each always removable with its
// x. Chips fade in/out and the rest slide into place (see PantryChip).
export function PantryIngredientTabs({ pantry, onRemove }: { pantry: PantryIngredient[]; onRemove: (id: string) => void }) {
  const groupOf = usePantryGroups(pantry);
  const [tab, setTab] = useState<Tab>("all");
  // A long pantry folds after FOLD_AT.
  const [expanded, setExpanded] = useState(false);

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
  const inTab = activeTab === "all" ? pantry : pantry.filter((p) => (groupOf.get(p.id) ?? "staples") === activeTab);
  const folded = !expanded && inTab.length > FOLD_AT;
  const shown = folded ? inTab.slice(0, FOLD_AT) : inTab;

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
          <PantryChip key={item.id} item={item} group={groupOf.get(item.id)} onRemove={() => onRemove(item.id)} />
        ))}
        {folded && (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            className="rounded-full border border-ink-emphasis/10 bg-white px-3.5 py-2 active:bg-ink-emphasis/5"
          >
            <Text className="font-inter-semibold text-body text-primary">+{inTab.length - FOLD_AT} more</Text>
          </Pressable>
        )}
        {expanded && inTab.length > FOLD_AT && (
          <Pressable onPress={() => setExpanded(false)} accessibilityRole="button" className="justify-center px-2 py-2 active:opacity-60">
            <Text className="font-inter-semibold text-body text-ink-subtle">Show less</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
