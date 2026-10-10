import { useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { AppText, Avatar, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { BestValueMealsSection } from "@/frontend/core/meals/components/BestValueMealsSection";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { pickFreshPicks, type PriceCategory, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { FRESH_PICKS_COUNT, FreshPicksSection } from "../components/FreshPicksSection";
import { CategoryGrid } from "../components/CategoryGrid";
import { PriceListSection } from "../components/PriceListSection";
import { PriceDetailSheet } from "../components/PriceDetailSheet";
import { PriceDisclaimer } from "../components/PriceDisclaimer";
import { MarketsSheet } from "../components/MarketsSheet";
import { priceWatchCategories } from "../constants/categories";

// DA's daily prices (Admin → DA Daily Prices), compared week over week:
// fresh picks, best value meals, and every commodity by category.
// Breathing room above the list section when search scrolls it to the top.
const SEARCH_TOP_GAP = 12;

export default function PriceWatchScreen() {
  const items = usePriceItems();
  const [category, setCategory] = useState<PriceCategory | null>("meat");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searching = searchFocused || search.trim() !== "";
  const scrollRef = useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  // Where the "All" list section starts in the scroll content.
  const [listY, setListY] = useState(0);
  // Focusing search parks its section (title, sort chip, search box) at the
  // top of the screen, and the min height below keeps it there as you type.
  const handleSearchFocus = () => {
    setSearchFocused(true);
    scrollRef.current?.scrollTo({ y: Math.max(0, listY - SEARCH_TOP_GAP), animated: true });
  };
  const [sortByDrop, setSortByDrop] = useState(true);
  const [selected, setSelected] = useState<PriceItem | null>(null);
  const [marketsOpen, setMarketsOpen] = useState(false);
  // Meal Details is its own Modal: opened only after the detail sheet has
  // fully closed (see BottomSheet's onClosed), never on top of it.
  const [pendingMeal, setPendingMeal] = useState<MealType | null>(null);
  const [meal, setMeal] = useState<MealType | null>(null);

  const all = items.data ?? [];
  const picks = useMemo(() => pickFreshPicks(all, FRESH_PICKS_COUNT), [all]);

  const q = search.trim().toLowerCase();
  const listed = useMemo(() => {
    const filtered = all.filter((i) =>
      q ? `${i.name} ${i.specification}`.toLowerCase().includes(q) : !category || i.category === category,
    );
    // Biggest drop first; no change data counts as 0. Off: A–Z (query order).
    return sortByDrop ? [...filtered].sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0)) : filtered;
  }, [all, q, category, sortByDrop]);

  // Searching covers every category.
  const handleSearch = (text: string) => {
    setSearch(text);
    if (text.trim()) setCategory(null);
  };

  const title = q || !category ? "All" : priceWatchCategories.find((c) => c.id === category)!.label;

  return (
    <Screen edges={["top"]} dismissKeyboardOnTap={false}>
      {/* Edge to edge, with Screen's px-7 moved inside the content, so the
          fresh picks arrows can sit half outside the cards without the
          ScrollView clipping them. */}
      <ScrollView
        ref={scrollRef}
        className="-mx-7 flex-1"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 28 }}
        refreshControl={
          <RefreshControl refreshing={items.isRefetching} onRefresh={() => items.refetch()} tintColor={colors.primary} />
        }
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <AppText variant="title">Price Watch</AppText>
            <AppText variant="caption">See what&apos;s cheaper this week and cook for less.</AppText>
          </View>
          {/* TODO: "Patrick" is a placeholder — replace with the
              authenticated user's first name once auth/profile data is
              wired up. */}
          <Avatar name="Patrick" size={48} />
        </View>

        <View className="mt-4">
          <PriceDisclaimer variant="banner" onOpenMarkets={() => setMarketsOpen(true)} />
          {items.isError && (
            <AppText variant="caption" className="mt-2 text-like">
              Couldn&apos;t load prices. Pull to refresh.
            </AppText>
          )}
        </View>

        <View className="mt-6">
          <FreshPicksSection picks={picks} loading={items.isLoading} onSelect={setSelected} />
        </View>

        <View className="mt-6">
          <BestValueMealsSection />
        </View>

        <View className="mt-6">
          <CategoryGrid selected={category} onSelect={setCategory} />
        </View>

        {/* While searching, at least a screen tall: filtering shrinks the
            list, and a page shorter than the scroll position would make
            the ScrollView jump back up. */}
        <View
          className="mt-6"
          onLayout={(e) => setListY(e.nativeEvent.layout.y)}
          style={searching ? { minHeight: windowHeight } : undefined}
        >
          <PriceListSection
            title={title}
            items={listed}
            loading={items.isLoading}
            search={search}
            onSearch={handleSearch}
            sortByDrop={sortByDrop}
            onToggleSort={() => setSortByDrop((v) => !v)}
            onSelect={setSelected}
            onSearchFocus={handleSearchFocus}
            onSearchBlur={() => setSearchFocused(false)}
          />
        </View>
      </ScrollView>

      <PriceDetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onOpenMeal={(m) => {
          setPendingMeal(m);
          setSelected(null);
        }}
        onClosed={() => {
          if (pendingMeal) {
            setMeal(pendingMeal);
            setPendingMeal(null);
          }
        }}
      />
      <MarketsSheet visible={marketsOpen} onClose={() => setMarketsOpen(false)} />
      <MealDetailSheet meal={meal} onClose={() => setMeal(null)} />
    </Screen>
  );
}
