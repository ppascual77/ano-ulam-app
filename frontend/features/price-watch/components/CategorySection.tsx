import { memo, startTransition, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronRight, Search } from "lucide-react-native";
import { AppText, SegmentedSwitch } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";
import { trendOf, type PriceCategory, type PriceItem, type Trend } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { priceWatchCategories } from "../constants/categories";
import { PriceRow } from "./PriceRow";

// How many rows a tab shows; the rest are in the full list (See all).
const TOP = 5;
const SKELETON_ROWS = 5;
const BAR_MS = 620;
const EASE = Easing.out(Easing.cubic);

const TABS: { value: Trend; label: string }[] = [
  { value: "down", label: "Cheaper" },
  { value: "flat", label: "Steady" },
  { value: "up", label: "Pricier" },
];

type CategorySectionProps = {
  /** Every commodity (the rail counts and the search pill use them all). */
  items: PriceItem[];
  loading: boolean;
  category: PriceCategory;
  onCategory: (category: PriceCategory) => void;
  onSelect: (item: PriceItem) => void;
  /** Opens the full list: this category, or every category to search. */
  onSeeAll: (scope: PriceCategory | "all") => void;
};

// Price Watch's "Check by category", kept short: a search pill (opens the
// full list searching every category), a rail of categories with counts,
// how the picked category moved this week (a cheaper / steady / pricier bar),
// tabs for those three with the top 5 of each, and "See all" for the rest
// in a sheet. Same height whatever the category, so the page never grows.
//
// Motion on a category switch: the chip fills, the bar grows from the left
// as the counts tick up, and the rows cascade in with their sparklines
// drawing. Plain fades with Reduce motion.
function CategorySectionInner({ items, loading, category, onCategory, onSelect, onSeeAll }: CategorySectionProps) {
  const reduce = useReduceMotion();
  // The pick as shown here, ahead of the screen's update (a transition).
  const [current, setCurrent] = useState(category);
  useEffect(() => setCurrent(category), [category]);
  const [tab, setTab] = useState<Trend>("down");

  const counts = useMemo(() => {
    const c = {} as Record<PriceCategory, number>;
    for (const i of items) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [items]);
  const inCategory = useMemo(() => items.filter((i) => i.category === current), [items, current]);
  const groups = useMemo(() => {
    const g: Record<Trend, PriceItem[]> = { down: [], flat: [], up: [] };
    for (const i of inCategory) g[trendOf(i.pctChange)].push(i);
    g.down.sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0));
    g.up.sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0));
    g.flat.sort((a, b) => a.latestPrice - b.latestPrice);
    return g;
  }, [inCategory]);
  const label = priceWatchCategories.find((c) => c.id === current)?.label ?? "";

  const pick = (id: PriceCategory) => {
    if (id === current) return;
    void Haptics.selectionAsync();
    setCurrent(id);
    // Lead with what got cheaper, or whichever tab has anything.
    setTab("down");
    startTransition(() => onCategory(id));
  };
  // A tab with nothing in it shows the next one that has something.
  const shownTab = groups[tab].length > 0 ? tab : (TABS.find((t) => groups[t.value].length > 0)?.value ?? tab);
  const rows = groups[shownTab].slice(0, TOP);
  const enter = (i: number) => (reduce ? FadeIn.duration(160) : FadeInDown.delay(i * 55).duration(320).easing(EASE));

  return (
    <View className="gap-3">
      <AppText variant="sectionTitle" dot>
        Check by category
      </AppText>

      <Pressable
        onPress={() => onSeeAll("all")}
        accessibilityRole="search"
        accessibilityLabel={`Search ${items.length} ingredients`}
        className="h-12 flex-row items-center gap-2 rounded-full border border-ink-emphasis/10 bg-white px-4 active:bg-ink-emphasis/5"
      >
        <Search color={colors.ink.subtle} size={17} />
        <Text className="font-inter-regular text-body text-ink-placeholder">
          Search {items.length > 0 ? `${items.length} ` : ""}ingredients…
        </Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
        {priceWatchCategories.map((c) => {
          const on = c.id === current;
          return (
            <Pressable
              key={c.id}
              onPress={() => pick(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c.label}, ${counts[c.id] ?? 0} prices`}
              className={`flex-row items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 ${
                on ? "border-primary bg-primary" : "border-ink-emphasis/10 bg-white active:bg-ink-emphasis/5"
              }`}
            >
              <View className={`h-7 w-7 items-center justify-center rounded-full ${on ? "bg-white" : "bg-mood-bg"}`}>
                <Image source={c.icon} style={{ width: 20, height: 20 }} contentFit="contain" />
              </View>
              <Text className={`font-inter-semibold text-body ${on ? "text-white" : "text-ink-emphasis"}`}>{c.label}</Text>
              <Text className={`font-inter-bold text-sub ${on ? "text-white/75" : "text-ink-placeholder"}`}>{counts[c.id] ?? 0}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View className="gap-2">
          <View className="h-28 rounded-3xl bg-ink-emphasis/5" />
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <View key={i} className="h-12 rounded-2xl bg-ink-emphasis/5" />
          ))}
        </View>
      ) : inCategory.length === 0 ? (
        <AppText variant="caption" className="py-6 text-center">
          No {label.toLowerCase()} prices from DA yet.
        </AppText>
      ) : (
        <>
          <WeekSummary key={current} label={label} groups={groups} />

          <SegmentedSwitch
            size="md"
            options={TABS.map((t) => ({ value: t.value, label: `${t.label} ${groups[t.value].length}` }))}
            value={shownTab}
            onChange={(t) => {
              void Haptics.selectionAsync();
              setTab(t);
            }}
          />

          <View key={`${current}-${shownTab}`}>
            {rows.map((item, i) => (
              <Animated.View key={item.id} entering={enter(i)}>
                <PriceRow item={item} onPress={() => onSelect(item)} delay={reduce ? 0 : 120 + i * 55} last={i === rows.length - 1} />
              </Animated.View>
            ))}
          </View>

          <Pressable
            onPress={() => onSeeAll(current)}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-1 rounded-2xl border border-ink-emphasis/10 py-3.5 active:bg-ink-emphasis/5"
          >
            <Text className="font-inter-bold text-body text-primary">
              See all {inCategory.length} {label.toLowerCase()} prices
            </Text>
            <ChevronRight color={colors.primary} size={16} strokeWidth={2.5} />
          </Pressable>
        </>
      )}
    </View>
  );
}

// "Meat this week": how many got cheaper, a bar of cheaper / steady /
// pricier that grows from the left (keyed per category, so it replays), and
// the biggest drop.
function WeekSummary({ label, groups }: { label: string; groups: Record<Trend, PriceItem[]> }) {
  const reduce = useReduceMotion();
  const total = groups.down.length + groups.flat.length + groups.up.length;
  const cheaper = Math.round(useCountTo(0, groups.down.length, 80, 600));
  const [barW, setBarW] = useState(0);
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) grow.value = withTiming(1, { duration: BAR_MS, easing: EASE });
  }, [grow, reduce]);
  // The three segments share the bar (less two 4px gaps), scaled by `grow`.
  const room = Math.max(0, barW - 8);
  const share = (n: number) => (total ? (room * n) / total : 0);
  const [dW, fW, uW] = [share(groups.down.length), share(groups.flat.length), share(groups.up.length)];
  const down = useAnimatedStyle(() => ({ width: dW * grow.value }));
  const flat = useAnimatedStyle(() => ({ width: fW * grow.value }));
  const up = useAnimatedStyle(() => ({ width: uW * grow.value }));
  const best = groups.down[0];

  return (
    <View className="rounded-3xl bg-mood-bg p-4">
      <Text className="font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">{label} this week</Text>
      <Text className="mt-1 font-inter-extrabold text-subheading tracking-display text-ink-emphasis">
        {groups.down.length > 0 ? (
          <>
            <Text className="text-trend-down">{cheaper} cheaper</Text> than last week
          </>
        ) : (
          "Nothing cheaper than last week"
        )}
      </Text>
      <View className="mt-3 h-2.5 flex-row gap-1" onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.trend.down }, down]} />
        <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.trend.flat }, flat]} />
        <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.trend.up }, up]} />
      </View>
      <View className="mt-2 flex-row justify-between">
        <Legend color={colors.trend.down} text={`${groups.down.length} cheaper`} />
        <Legend color={colors.trend.flat} text={`${groups.flat.length} steady`} />
        <Legend color={colors.trend.up} text={`${groups.up.length} pricier`} />
      </View>
      {best && (
        // The percentage first, so only a long name gets cut off.
        <Text numberOfLines={1} className="mt-2 font-inter-regular text-small text-ink">
          Biggest drop: <Text className="font-inter-bold text-trend-down">↓{Math.abs(best.pctChange ?? 0)}%</Text>
          {" · "}
          <Text className="font-inter-semibold text-ink-emphasis">{best.name.split(",")[0]}</Text>
        </Text>
      )}
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="font-inter-semibold text-sub text-ink-subtle">{text}</Text>
    </View>
  );
}

// Re-renders only when its own props change (a Price Watch re-render, e.g.
// on a tab switch, cost ~150-200ms when every section re-rendered with it).
export const CategorySection = memo(CategorySectionInner);
