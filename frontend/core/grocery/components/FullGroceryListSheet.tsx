import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Info } from "lucide-react-native";
import { BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/mock/api";
import type { GroceryItem } from "../utils/buildGroceryList";
import { GroceryRow, formatPeso } from "./GroceryRow";

// One list in the sheet: saved meals, or the meal plan.
export type GroceryListTab = {
  key: string;
  label: string;
  items: GroceryItem[];
  total: number;
  isChecked: (item: GroceryItem) => boolean;
  onToggle: (item: GroceryItem) => void;
  /** Shown when the list has no items. */
  emptyText: string;
};

type FullGroceryListSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** With more than one, a tab switcher shows under the title. */
  tabs: GroceryListTab[];
  /** Which tab it opens on (defaults to the first). */
  initialTab?: string;
  pantry: PantryIngredient[];
};

function LegendPill({ label, className, textClassName }: { label: string; className: string; textClassName: string }) {
  return (
    <View className={`rounded-full px-1.5 py-0.5 ${className}`}>
      <Text className={`font-inter-semibold text-sub ${textClassName}`}>{label}</Text>
    </View>
  );
}

// The grocery list, one tab per source (Saved meals, Meal plan) when there's
// more than one, with "Have" on items already in the pantry. Profile and the
// Meal Planner both open this same sheet, each on its own tab.
export function FullGroceryListSheet({ visible, onClose, tabs, initialTab, pantry }: FullGroceryListSheetProps) {
  const [activeKey, setActiveKey] = useState(initialTab ?? tabs[0]?.key);
  useEffect(() => {
    if (visible) setActiveKey(initialTab ?? tabs[0]?.key);
    // Reset to the caller's tab on each open.
  }, [visible]);
  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  if (!tab) return null;
  const { items, total, isChecked, onToggle } = tab;
  const anyHave = items.some((item) => pantryHas(pantry, item.name));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerClassName="px-6 pb-10 pt-10" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-inter-semibold text-subheading text-web-ink">Grocery List</Text>
              <View className="rounded-full bg-web-divider px-1.5 py-0.5">
                <Text className="font-inter-medium text-sub text-web-ink-muted">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">Everything you need for your meal prep.</Text>
          </View>
          <View className="items-end">
            <Text className="font-inter-regular text-small text-web-ink-muted">Total</Text>
            <Text className="font-inter-semibold text-body text-brand-green">~₱{formatPeso(total)}</Text>
          </View>
        </View>

        {tabs.length > 1 && (
          <View className="mt-4 flex-row rounded-xl bg-web-divider/70 p-1">
            {tabs.map((t) => {
              const selected = t.key === tab.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setActiveKey(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-lg py-2 ${selected ? "bg-white shadow-sm" : ""}`}
                >
                  <Text className={`font-inter-semibold text-small ${selected ? "text-brand-green" : "text-web-ink-muted"}`}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="mt-4 flex-row gap-2 rounded-xl border border-notice-border bg-notice-bg px-3 py-2.5">
          <Info color={colors.notice.icon} size={14} />
          <Text className="flex-1 font-inter-regular text-sub leading-4 text-notice-text">
            Prices shown are for the exact quantities used across your meals. Some items may only be available as a whole
            unit, so your actual spend may be higher.
          </Text>
        </View>

        {items.length === 0 && (
          <Text className="py-8 text-center font-inter-regular text-body text-web-ink-muted">{tab.emptyText}</Text>
        )}
        <View className="mt-2">
          {items.map((item, i) => (
            <GroceryRow
              key={item.id}
              item={item}
              checked={isChecked(item)}
              onToggle={() => onToggle(item)}
              isLast={i === items.length - 1}
              wrap
              have={pantryHas(pantry, item.name)}
            />
          ))}
        </View>

        <View className="mt-5 flex-row flex-wrap items-center gap-x-3 gap-y-2 border-t border-web-divider pt-4">
          <View className="flex-row items-center gap-1.5">
            <LegendPill label="Main" className="bg-brand-green/10" textClassName="text-brand-green" />
            <Text className="font-inter-regular text-sub text-web-ink-muted">Needs to buy</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <LegendPill label="Pantry" className="bg-web-divider" textClassName="text-web-ink-muted" />
            <Text className="font-inter-regular text-sub text-web-ink-muted">Usually in your kitchen</Text>
          </View>
          {anyHave && (
            <View className="flex-row items-center gap-1.5">
              <LegendPill label="Have" className="bg-brand-green" textClassName="text-white" />
              <Text className="font-inter-regular text-sub text-web-ink-muted">In your pantry</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
