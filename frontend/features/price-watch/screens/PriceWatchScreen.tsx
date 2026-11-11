import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View, type ScrollViewInstance } from "react-native";
// Gesture handler's ScrollView (and RefreshControl), not React Native's: the
// fresh picks carousel pages with a gesture-handler pan, and inside RN's
// ScrollView the scroll view's native pan took the touch on the phone, so
// the carousel never swiped. Here both negotiate: horizontal drags page the
// carousel, vertical ones scroll.
import { RefreshControl, ScrollView } from "react-native-gesture-handler";
import {
  AppText,
  HeaderBackdrop,
  LandingTitle,
  Screen,
  usePageIntro,
  useStatusBarStrip,
  TAB_HEADER_CURVES,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { BestValueMealsSection } from "@/frontend/core/meals/components/BestValueMealsSection";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIntroOnce } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { pickFreshPicks, type PriceCategory, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { FRESH_PICKS_COUNT, FreshPicksSection } from "../components/FreshPicksSection";
import { CategorySection } from "../components/CategorySection";
import { PriceListSheet } from "../components/PriceListSheet";
import { PriceWatchIntro } from "../components/PriceWatchIntro";
import { PriceDetailSheet } from "../components/PriceDetailSheet";
import { PriceDisclaimer } from "../components/PriceDisclaimer";
import { MarketsSheet } from "../components/MarketsSheet";

// DA's daily prices (Admin → DA Daily Prices), compared week over week:
// fresh picks, best value meals, and each category's week (the full list,
// and search, in a sheet).
// Plays the "Straight from the Department of Agriculture" intro on moving to Price Watch.
// TODO: gate this behind a first-time-user flag (the auto tour), e.g. a
// stored "seen" flag, instead of always.
const SHOW_INTRO = true;



export default function PriceWatchScreen() {
  const items = usePriceItems();
  const [category, setCategory] = useState<PriceCategory>("meat");
  // The intro, replayed on every visit to the tab (see usePageIntro). The
  // header's dot stays hidden until the intro's dot lands on it. Leaving the
  // tab puts the header back at the top, ready for the next landing.
  // Never with Reduce motion on (Settings, or the phone's own setting).
  const reduceMotion = useReduceMotion();
  const introOnce = useIntroOnce("price-watch");
  const intro = usePageIntro({
    enabled: SHOW_INTRO && !reduceMotion && introOnce.due,
    onArm: () => scrollRef.current?.scrollTo({ y: 0, animated: false }),
    onFinish: introOnce.markSeen,
  });
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Stable callbacks, so the memoized sections below don't re-render for
  // them (each section is memo()'d: re-rendering them all made switching to
  // this tab cost ~150-200ms).
  const openMarkets = useCallback(() => setMarketsOpen(true), []);
  const [selected, setSelected] = useState<PriceItem | null>(null);
  // The full list (a category's, or every category's to search). A row
  // picked there opens its detail only once the list has closed (two
  // sheets can't stack), like the meal hand-off below.
  const [listScope, setListScope] = useState<PriceCategory | "all" | null>(null);
  const [pendingItem, setPendingItem] = useState<PriceItem | null>(null);
  const openList = useCallback((scope: PriceCategory | "all") => setListScope(scope), []);
  const [marketsOpen, setMarketsOpen] = useState(false);
  // Meal Details is its own Modal: opened only after the detail sheet has
  // fully closed (see BottomSheet's onClosed), never on top of it.
  const [pendingMeal, setPendingMeal] = useState<MealType | null>(null);
  const [meal, setMeal] = useState<MealType | null>(null);

  const all = items.data ?? [];
  const picks = useMemo(() => pickFreshPicks(all, FRESH_PICKS_COUNT), [all]);
  // Latest DA publish date across all commodities, for the source chip.
  const asOf = useMemo(() => all.reduce<string | undefined>((max, i) => (!max || i.latestDate > max ? i.latestDate : max), undefined), [all]);

  // Where the source chip ends: the green header covers up to it.
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);
  // Dark green behind the clock over the header, white once it has scrolled
  // up past it. Dark clock over the intro.
  // On screen: the fresh picks' prices roll then (not hidden under the
  // intro, or on a tab that isn't showing), and again on each return.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  // Clear while the textured header still fills it (no hard line where a
  // solid strip would meet the header's light), like Browse.
  const statusBar = useStatusBarStrip({
    color: colors.home.top,
    darkUntil: headerBottom ?? 190,
    forceDark: intro.showing,
    clearUntil: (headerBottom ?? 190) * TAB_HEADER_CURVES.splitAt - 24,
  });
  return (
    // No top edge: the content scrolls under the status bar (behind
    // statusBar.strip), starting below it.
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      {/* Edge to edge, with Screen's px-5 moved inside the content, so the
          fresh picks arrows can sit half outside the cards without the
          ScrollView clipping them (and the green header runs edge to edge). */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: statusBar.top + 8, paddingBottom: 40, paddingHorizontal: 20 }}
        onScroll={statusBar.onScroll}
        scrollEventThrottle={32}
        refreshControl={
          // White: it shows over the green header.
          <RefreshControl refreshing={items.isRefetching} onRefresh={() => void items.refetch()} tintColor={colors.white} />
        }
      >
        <HeaderBackdrop bottom={headerBottom} curves={TAB_HEADER_CURVES} texture />
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            {/* "Price Watch." like the other section titles, with a real
                dot (not a "." glyph) so the intro's dot has a spot to land. */}
            <LandingTitle dotRef={intro.targetRef} showDot={intro.landed} light>
              Price Watch
            </LandingTitle>
            <AppText variant="caption" className="text-white/80">
              See what&apos;s cheaper this week and cook for less.
            </AppText>
          </View>
        </View>

        <View className="mt-4" onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <PriceDisclaimer asOf={asOf} onOpenMarkets={openMarkets} />
          {items.isError && (
            <AppText variant="caption" className="mt-2 text-like">
              Couldn&apos;t load prices. Pull to refresh.
            </AppText>
          )}
        </View>

        <View className="mt-6">
          <FreshPicksSection picks={picks} loading={items.isLoading} onSelect={setSelected} visible={focused && !intro.showing} />
        </View>

        <View className="mt-6">
          <BestValueMealsSection />
        </View>

        <View className="mt-6">
          <CategorySection
            items={all}
            loading={items.isLoading}
            category={category}
            onCategory={setCategory}
            onSelect={setSelected}
            onSeeAll={openList}
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
      <PriceListSheet
        scope={listScope}
        items={all}
        onClose={() => setListScope(null)}
        onSelect={(item) => {
          setPendingItem(item);
          setListScope(null);
        }}
        onClosed={() => {
          if (pendingItem) {
            setSelected(pendingItem);
            setPendingItem(null);
          }
        }}
      />
      <MarketsSheet visible={marketsOpen} onClose={() => setMarketsOpen(false)} />
      <MealDetailSheet meal={meal} onClose={() => setMeal(null)} />
      {statusBar.strip}
      {/* Below the status bar, where it sat before the page went under it. */}
      {intro.showing && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: statusBar.top, left: 0, right: 0, bottom: 0 }}>
          <PriceWatchIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />
        </View>
      )}
    </Screen>
  );
}
