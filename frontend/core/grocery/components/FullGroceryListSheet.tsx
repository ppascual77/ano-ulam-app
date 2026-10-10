import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Info, MapPin } from "lucide-react-native";
import { AppText, BottomSheet, SegmentedSwitch, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/mock/api";
import type { GroceryItem } from "../utils/buildGroceryList";
import { GroceryRow, formatPeso } from "./GroceryRow";
import { GrocerySectionHeader, splitGroceryItems } from "./GrocerySection";

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

// "Include in total" (pantry staples) sticks for the app session, across
// opens and tabs.
let includePantrySession = false;

function LegendPill({ label, className, textClassName }: { label: string; className: string; textClassName: string }) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${className}`}>
      <Text className={`font-inter-extrabold text-small ${textClassName}`}>{label}</Text>
    </View>
  );
}

const COUNT_UP_MS = 600;

// The total ticks up from 0 each time the sheet opens (or the tab changes),
// like the teaser's grocery list. Other changes (the pantry toggle) tick from
// the current value to the new one.
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
  const [includePantry, setIncludePantry] = useState(includePantrySession);
  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  // Main ingredients, plus pantry staples when they're switched on.
  const total = (tab?.items ?? []).reduce(
    (sum, item) => (item.category === "main" || includePantry ? sum + item.price : sum),
    0,
  );
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
  const anyHave = items.some((item) => pantryHas(pantry, item.name));
  const anyShared = items.some((item) => item.meals > 1);
  const { mains, staples } = splitGroceryItems(items);
  const mainsSubtotal = mains.reduce((sum, item) => sum + item.price, 0);

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
        pricePantry={includePantry}
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
        {/* What to buy (main ingredients) first, then pantry staples. */}
        {mains.length > 0 && (
          <View className="mt-5">
            <GrocerySectionHeader title="To buy" count={mains.length} />
            <View className="mt-1">{renderRows(mains)}</View>
            {/* Only worth showing when staples could add to the total. */}
            {staples.length > 0 && (
              <View className="flex-row items-center justify-between px-2 pt-2">
                <Text className="font-inter-medium text-small text-ink-subtle">Subtotal</Text>
                <Text className="font-inter-bold text-body text-ink-emphasis">₱{formatPeso(mainsSubtotal, 0)}</Text>
              </View>
            )}
          </View>
        )}

        {staples.length > 0 && (
          <View className="mt-6">
            <GrocerySectionHeader
              title="Pantry staples"
              count={staples.length}
              right={
                <View className="flex-row items-center gap-2">
                  <Text className="font-inter-medium text-small text-ink-subtle">Include in total</Text>
                  <Toggle
                    checked={includePantry}
                    onChange={(on) => {
                      includePantrySession = on;
                      setIncludePantry(on);
                    }}
                  />
                </View>
              }
            />
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

        {(anyHave || anyShared) && (
          <View className="mt-5 gap-2.5 rounded-2xl bg-ink-emphasis/5 p-4">
            {anyHave && (
              <View className="flex-row items-center gap-2">
                <LegendPill label="Have" className="bg-tinted-bg" textClassName="text-primary" />
                <Text className="flex-1 font-inter-regular text-small text-ink-subtle">In your pantry, already checked</Text>
              </View>
            )}
            {anyShared && (
              <View className="flex-row items-center gap-2">
                <LegendPill label="2 meals" className="bg-category-breakfast" textClassName="text-accent" />
                <Text className="flex-1 font-inter-regular text-small text-ink-subtle">Combined from more than one meal</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
