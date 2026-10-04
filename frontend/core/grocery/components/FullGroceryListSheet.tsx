import { ScrollView, Text, View } from "react-native";
import { Info } from "lucide-react-native";
import { BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/mock/api";
import type { GroceryItem } from "../utils/buildGroceryList";
import { GroceryRow, formatPeso } from "./GroceryRow";

type FullGroceryListSheetProps = {
  visible: boolean;
  onClose: () => void;
  items: GroceryItem[];
  total: number;
  pantry: PantryIngredient[];
  isChecked: (item: GroceryItem) => boolean;
  onToggle: (item: GroceryItem) => void;
};

function LegendPill({ label, className, textClassName }: { label: string; className: string; textClassName: string }) {
  return (
    <View className={`rounded-full px-1.5 py-0.5 ${className}`}>
      <Text className={`font-inter-semibold text-sub ${textClassName}`}>{label}</Text>
    </View>
  );
}

// Every grocery item, with "Have" on the ones already in the pantry.
export function FullGroceryListSheet({ visible, onClose, items, total, pantry, isChecked, onToggle }: FullGroceryListSheetProps) {
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

        <View className="mt-4 flex-row gap-2 rounded-xl border border-notice-border bg-notice-bg px-3 py-2.5">
          <Info color={colors.notice.icon} size={14} />
          <Text className="flex-1 font-inter-regular text-sub leading-4 text-notice-text">
            Prices shown are for the exact quantities used across your meals. Some items may only be available as a whole
            unit, so your actual spend may be higher.
          </Text>
        </View>

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
