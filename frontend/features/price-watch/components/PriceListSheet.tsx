import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { AppText, BottomSheet, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { formatPeso, unitSuffix, type PriceCategory, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { priceWatchCategories } from "../constants/categories";
import { ChangePill, PriceRow } from "./PriceRow";
import { PriceSparkline } from "./PriceSparkline";

type Sort = "drop" | "price" | "az";
const SORTS: { id: Sort; label: string }[] = [
  { id: "drop", label: "Biggest drop" },
  { id: "price", label: "Lowest price" },
  { id: "az", label: "A–Z" },
];

// "Pork Belly (Liempo), Local" → family "Pork Belly (Liempo)", kind "Local".
const familyOf = (name: string) => name.split(",")[0].trim();
const kindOf = (item: PriceItem) => item.name.split(",").slice(1).join(",").trim() || "Local";
// Meat reads better under Pork / Beef / Chicken; other categories need no headers.
function groupOf(item: PriceItem): string | null {
  if (item.category !== "meat") return null;
  if (/pork/i.test(item.name)) return "Pork";
  if (/beef|carabeef/i.test(item.name)) return "Beef";
  if (/chicken|poultry/i.test(item.name)) return "Chicken";
  return "Other meat";
}

const sorter: Record<Sort, (a: PriceItem, b: PriceItem) => number> = {
  drop: (a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0),
  price: (a, b) => a.latestPrice - b.latestPrice,
  az: (a, b) => a.name.localeCompare(b.name),
};

type Family = { name: string; items: PriceItem[] };
type Group = { title: string | null; families: Family[] };

// Families (kinds of one commodity) in sort order, under their headers.
function buildGroups(items: PriceItem[], sort: Sort): Group[] {
  const sorted = [...items].sort(sorter[sort]);
  const groups = new Map<string | null, Map<string, PriceItem[]>>();
  for (const item of sorted) {
    const g = groupOf(item);
    if (!groups.has(g)) groups.set(g, new Map());
    const fams = groups.get(g)!;
    const f = familyOf(item.name);
    fams.set(f, [...(fams.get(f) ?? []), item]);
  }
  return [...groups.entries()].map(([title, fams]) => ({
    title,
    families: [...fams.entries()].map(([name, list]) => ({ name, items: list })),
  }));
}

type PriceListSheetProps = {
  /** A category, or "all" (opened from search: every category). null = closed. */
  scope: PriceCategory | "all" | null;
  items: PriceItem[];
  onClose: () => void;
  onClosed?: () => void;
  onSelect: (item: PriceItem) => void;
};

// The full price list, in a sheet so the page stays short: search (focused
// when opened from the search pill), sort by biggest drop / lowest price /
// A–Z, Meat under Pork / Beef / Chicken, and a commodity sold in several
// kinds (Local, Frozen) folded into one row with its "from" price; tap to
// unfold.
export function PriceListSheet({ scope, items, onClose, onClosed, onSelect }: PriceListSheetProps) {
  // Kept while closing, so the content doesn't blank out as it slides away.
  const [shown, setShown] = useState<PriceCategory | "all">("all");
  useEffect(() => {
    if (scope) setShown(scope);
  }, [scope]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("drop");
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Fresh each time it opens.
  useEffect(() => {
    if (!scope) return;
    setQuery("");
    setSort("drop");
    setOpen(new Set());
  }, [scope]);

  const label = shown === "all" ? "All" : (priceWatchCategories.find((c) => c.id === shown)?.label ?? "");
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      items.filter(
        (i) => (shown === "all" || i.category === shown) && (!q || `${i.name} ${i.specification}`.toLowerCase().includes(q)),
      ),
    [items, shown, q],
  );
  const groups = useMemo(() => buildGroups(list, sort), [list, sort]);
  const toggle = (name: string) => {
    void Haptics.selectionAsync();
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <BottomSheet visible={!!scope} onClose={onClose} onClosed={onClosed} heightPercent={0.9}>
      <View className="flex-1 px-5 pt-6">
        <View className="flex-row items-end justify-between">
          <AppText variant="sectionTitle" dot>
            {label} prices
          </AppText>
          <Text className="mb-1 font-inter-semibold text-small text-ink-subtle">{list.length} · DA</Text>
        </View>
        <View className="mt-3">
          <SearchBar
            placeholder={shown === "all" ? "Search every ingredient…" : `Search ${label.toLowerCase()}…`}
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery("")}
            autoFocus={scope === "all"}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View className="mt-3 flex-row gap-2">
          {SORTS.map((s) => {
            const on = s.id === sort;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSort(s.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={`rounded-full border px-3 py-1.5 ${on ? "border-primary/30 bg-primary/10" : "border-ink-emphasis/10 bg-white"}`}
              >
                <Text className={`font-inter-semibold text-small ${on ? "text-primary" : "text-ink-emphasis"}`}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView className="mt-2 flex-1" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {list.length === 0 ? (
            <AppText variant="caption" className="py-10 text-center">
              No ingredients found.
            </AppText>
          ) : (
            groups.map((g) => (
              <View key={g.title ?? "all"} className="mt-3">
                {g.title && (
                  <Text className="mb-1 font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">
                    {g.title} · {g.families.reduce((n, f) => n + f.items.length, 0)}
                  </Text>
                )}
                {g.families.map((f) =>
                  f.items.length === 1 ? (
                    <PriceRow key={f.items[0].id} item={f.items[0]} onPress={() => onSelect(f.items[0])} />
                  ) : (
                    <FamilyRows key={f.name} family={f} open={open.has(f.name)} onToggle={() => toggle(f.name)} onSelect={onSelect} />
                  ),
                )}
              </View>
            ))
          )}
          <View className="h-10" />
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

// A commodity sold in several kinds: one row ("2 kinds · from ₱280/kg", the
// best change), unfolding into a row per kind.
function FamilyRows({ family, open, onToggle, onSelect }: { family: Family; open: boolean; onToggle: () => void; onSelect: (item: PriceItem) => void }) {
  const cheapest = family.items.reduce((a, b) => (b.latestPrice < a.latestPrice ? b : a));
  const best = family.items.reduce((a, b) => ((b.pctChange ?? 0) < (a.pctChange ?? 0) ? b : a));
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${family.name}, ${family.items.length} kinds, from ${formatPeso(cheapest.latestPrice)}`}
        className="flex-row items-center gap-3 border-b border-ink-emphasis/5 py-2.5 active:opacity-70"
      >
        <PriceSparkline item={best} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-inter-semibold text-body text-ink-emphasis">
            {family.name}
          </Text>
          <Text numberOfLines={1} className="font-inter-regular text-sub text-ink-subtle">
            {family.items.length} kinds · from {formatPeso(cheapest.latestPrice)}
            {unitSuffix(cheapest)}
          </Text>
        </View>
        <ChangePill pct={best.pctChange} />
        <Chevron color={colors.ink.placeholder} size={16} />
      </Pressable>
      {open && (
        <View className="pl-14">
          {family.items.map((item) => (
            <PriceRow key={item.id} item={item} title={kindOf(item)} onPress={() => onSelect(item)} />
          ))}
        </View>
      )}
    </View>
  );
}
