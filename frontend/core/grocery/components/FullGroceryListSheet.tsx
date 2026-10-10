import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Info, MapPin } from "lucide-react-native";
import { AppText, BottomSheet, SegmentedSwitch } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/mock/api";
import type { GroceryItem } from "../utils/buildGroceryList";
import { GroceryRow, formatPeso } from "./GroceryRow";
import { GrocerySectionHeader, splitGroceryItems } from "./GrocerySection";
import { useStaplesToBuyStore } from "../store/useStaplesToBuyStore";

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

// A dashed line across the top of the footer. iOS won't dash a one-sided
// border, so this clips a fully dashed box down to its top edge.
const DASH_CLIP = { position: "absolute", top: 0, left: 0, right: 0, height: 2, overflow: "hidden" } as const;
const DASH_BOX = { height: 8, borderWidth: 2, borderStyle: "dashed", borderColor: colors.webInk.faint, borderRadius: 1 } as const;

function DashedRule() {
  return (
    <View pointerEvents="none" style={DASH_CLIP}>
      <View style={DASH_BOX} />
    </View>
  );
}

// Items already in the pantry get checked once when the sheet opens (per
// item, per app session), so unchecking one sticks until the next launch.
const autoCheckedHave = new Set<string>();

const COUNT_UP_MS = 600;

// The total ticks up from 0 each time the sheet opens (or the tab changes),
// like the teaser's grocery list. Other changes (moving a staple to "To
// buy") tick from the current value to the new one.
function useCountUp(target: number, resetKey: string, run: boolean) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const lastReset = useRef<string | null>(null);
  useEffect(() => {
    if (!run) {
      lastReset.current = null;
      return;
    }
    const from = lastReset.current === resetKey ? valueRef.current : 0;
    lastReset.current = resetKey;
    setValue(from);
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / COUNT_UP_MS);
      valueRef.current = from + (target - from) * (1 - Math.pow(1 - p, 3)); // ease-out cubic
      setValue(valueRef.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, resetKey, run]);
  return value;
}

export function FullGroceryListSheet({ visible, onClose, tabs, initialTab, pantry }: FullGroceryListSheetProps) {
  const [activeKey, setActiveKey] = useState(initialTab ?? tabs[0]?.key);
  useEffect(() => {
    if (visible) setActiveKey(initialTab ?? tabs[0]?.key);
    // Reset to the caller's tab on each open.
  }, [visible]);
  const moveStaple = useStaplesToBuyStore((s) => s.toggle);
  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  // "To buy": main ingredients and any staples moved there.
  const counted = (tab?.items ?? []).filter((item) => item.category === "main");
  const total = counted.reduce((sum, item) => sum + item.price, 0);
  // What the meals use of it. Whole packs cost more than what a recipe
  // uses, and the gap is what's left over in the pantry, which explains why
  // this total is higher than the meals' own prices.
  const used = counted.reduce((sum, item) => sum + item.usedPrice, 0);
  const leftover = Math.round(total) - Math.round(used) >= 1;
  const shownTotal = useCountUp(total, tab?.key ?? "", visible);

  useEffect(() => {
    if (!visible || !tab) return;
    for (const item of tab.items) {
      const key = `${tab.key}:${item.id}`;
      if (autoCheckedHave.has(key) || !pantryHas(pantry, item.name)) continue;
      autoCheckedHave.add(key);
      if (!tab.isChecked(item)) tab.onToggle(item);
    }
    // Runs when the sheet opens, the tab changes, or the list/pantry loads.
  }, [visible, tab?.key, tab?.items, pantry]);

  if (!tab) return null;
  const { items, isChecked, onToggle } = tab;
  const { mains, staples } = splitGroceryItems(items);

  const renderRows = (rows: typeof items) =>
    rows.map((item, i) => (
      <GroceryRow
        key={item.id}
        item={item}
        checked={isChecked(item)}
        onToggle={() => onToggle(item)}
        isLast={i === rows.length - 1}
        wrap
        have={pantryHas(pantry, item.name)}
        onMove={item.category === "pantry" || item.movedFromStaples ? () => moveStaple(item.id) : undefined}
      />
    ));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerClassName="px-6 pb-10 pt-10" showsVerticalScrollIndicator={false}>
        <AppText variant="sectionTitle" dot>Grocery list</AppText>
        <Text className="mt-0.5 font-inter-medium text-body text-ink-subtle">
          {items.length} item{items.length === 1 ? "" : "s"} · combined from your meals
        </Text>

        {tabs.length > 1 && (
          <View className="mt-4 items-start">
            <SegmentedSwitch
              size="md"
              options={tabs.map((t) => ({ value: t.key, label: t.label }))}
              value={tab.key}
              onChange={setActiveKey}
            />
          </View>
        )}

        {leftover && (
          <View className="mt-4 flex-row gap-2 rounded-xl border border-notice-border bg-notice-bg px-3 py-2.5">
            <Info color={colors.notice.icon} size={14} />
            <Text className="flex-1 font-inter-regular text-sub leading-4 text-notice-text">
              Some items only come in whole packs, so this is more than your meals use. The rest stays in your pantry.
            </Text>
          </View>
        )}

        {items.length === 0 && (
          <Text className="py-8 text-center font-inter-regular text-body text-web-ink-muted">{tab.emptyText}</Text>
        )}
        {/* What to buy (main ingredients) first, then pantry staples. */}
        {mains.length > 0 && (
          <View className="mt-5">
            <GrocerySectionHeader title="To buy" count={mains.length} />
            <View className="mt-1">{renderRows(mains)}</View>
          </View>
        )}

        {staples.length > 0 && (
          <View className="mt-6">
            <GrocerySectionHeader title="Pantry staples" count={staples.length} />
            <View className="mt-1">{renderRows(staples)}</View>
          </View>
        )}

        {items.length > 0 && (
          <View className="mt-4 flex-row items-center gap-3 pt-5">
            <DashedRule />
            <View className="flex-1 gap-1">
              <Text className="font-inter-bold text-body-lg text-ink-emphasis">Estimated total</Text>
              <View className="flex-row items-center gap-1">
                <MapPin color={colors.accent} size={13} />
                <Text className="font-inter-medium text-small text-ink-subtle">Prices from local market data</Text>
              </View>
            </View>
            <Text className="font-inter-extrabold text-heading text-primary">₱{formatPeso(shownTotal, 0)}</Text>
          </View>
        )}


      </ScrollView>
    </BottomSheet>
  );
}
