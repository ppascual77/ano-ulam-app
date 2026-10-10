import { useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { AppText, LandingTitle, Screen, usePageIntro } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { BestValueMealsSection } from "@/frontend/core/meals/components/BestValueMealsSection";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { pickFreshPicks, type PriceCategory, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { FRESH_PICKS_COUNT, FreshPicksSection } from "../components/FreshPicksSection";
import { CategoryGrid } from "../components/CategoryGrid";
import { PriceListSection } from "../components/PriceListSection";
import { PriceWatchIntro } from "../components/PriceWatchIntro";
import { PriceDetailSheet } from "../components/PriceDetailSheet";
import { PriceDisclaimer } from "../components/PriceDisclaimer";
import { MarketsSheet } from "../components/MarketsSheet";
import { priceWatchCategories } from "../constants/categories";

// DA's daily prices (Admin → DA Daily Prices), compared week over week:
// fresh picks, best value meals, and every commodity by category.
// Plays the "Straight from the DA" intro on moving to Price Watch.
// TODO: gate this behind a first-time-user flag (the auto tour), e.g. a
// stored "seen" flag, instead of always.
const SHOW_INTRO = true;

// Breathing room above the list section when search scrolls it to the top.
const SEARCH_TOP_GAP = 12;

export default function PriceWatchScreen() {
  const items = usePriceItems();
  const [category, setCategory] = useState<PriceCategory | null>("meat");
  const [search, setSearch] = useState("");
  // The intro, replayed on every visit to the tab (see usePageIntro). The
  // header's dot stays hidden until the intro's dot lands on it. Leaving the
  // tab puts the header back at the top, ready for the next landing.
  const intro = usePageIntro({ enabled: SHOW_INTRO, onArm: () => scrollRef.current?.scrollTo({ y: 0, animated: false }) });
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
  // Latest DA publish date across all commodities, for the source chip.
  const asOf = useMemo(() => all.reduce<string | undefined>((max, i) => (!max || i.latestDate > max ? i.latestDate : max), undefined), [all]);

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
            {/* "Price Watch." like the other section titles, with a real
                dot (not a "." glyph) so the intro's dot has a spot to land. */}
            <LandingTitle dotRef={intro.targetRef} showDot={intro.landed}>
              Price Watch
            </LandingTitle>
            <AppText variant="caption">See what&apos;s cheaper this week and cook for less.</AppText>
          </View>
        </View>

        <View className="mt-4">
          <PriceDisclaimer asOf={asOf} onOpenMarkets={() => setMarketsOpen(true)} />
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
      {intro.showing && (
        <PriceWatchIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />
      )}
    </Screen>
  );
}
