import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { Easing, FadeIn, FadeInDown, useSharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import { Clock } from "lucide-react-native";
import {
  AppText,
  HeaderBackdrop,
  LandingTitle,
  Screen,
  SearchBar,
  Toast,
  usePageIntro,
  useStatusBarStrip,
  TAB_HEADER_CURVES,
  type ToastState,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { DailyLimitSheet } from "@/frontend/core/pro/components/DailyLimitSheet";
import { leftHint } from "@/frontend/core/pro/dailyLimits";
import { CravingTagline } from "@/frontend/features/browse/components/CravingTagline";
import { CravingChips } from "@/frontend/features/browse/components/CravingChips";
import { BrowseMiniHeader, miniHeaderStart } from "@/frontend/features/browse/components/BrowseMiniHeader";
import { PotRefreshDoodle } from "@/frontend/features/browse/components/PotRefreshDoodle";
import { realMealKeys } from "@/frontend/core/meals/hooks/useRealMeals";
import { MoodSelection } from "@/frontend/features/browse/components/MoodSelection";
import { TodaysPickCard } from "@/frontend/core/meals/components/card/TodaysPickCard";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { type SignInProvider, useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { LoginGateSheet, type LoginGateReason } from "@/frontend/features/auth/components/LoginGateSheet";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIntroOnce } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { useBrowseSearch } from "../hooks/useBrowseSearch";
import { hoursUntilNextPick, useTodaysPick } from "../hooks/useTodaysPick";
import { countFilters } from "../utils/filters";
import { FilterButton } from "../components/FilterButton";
import { FilterSheet } from "../components/FilterSheet";
import { SearchResults } from "../components/SearchResults";
import { EmptyMealView, GuestLimitGate } from "../components/EmptyStates";
import { AvoidedMealCover } from "../components/AvoidedMealCover";
import { BrowseIntro } from "../components/BrowseIntro";

// TEMP (dev only): act signed in without a session (Google sign-in can't
// complete in Expo Go on a device). The DEV pill flips to guest, to test
// the login gates and the 3-searches-a-day limit. Remove with the others.
const DEV_FORCE_SIGNED_IN = __DEV__;


// How far (px) a pull has to go to refresh; the pot doodle fills in over it.
const PULL_DISTANCE = 90;
// A refresh shows the steaming pot at least this long, so it reads.
const MIN_REFRESH_MS = 900;
// The sections' entrance plays once per app session (tab screens stay
// mounted, so this is the first time Browse's content appears).
let entrancePlayed = false;

// Plays the "what are you craving" intro on moving to Browse.
// TODO: gate this behind a first-time-user flag (the auto tour), e.g. a
// stored "seen" flag, instead of always.
const SHOW_INTRO = true;


// Browse: the default view (Today's pick, moods) until the user searches or
// filters, then "Search Results" grouped into Luto / Snacks / Fast food
// rows from the real catalog. Guests get a login gate for saving; searches
// are limited per day (guests 3, free accounts 10, Pro none: useBrowseSearch).
export default function BrowseScreen() {
  const { isSignedIn } = useAuth();
  const signIn = useSignIn();
  const [devGuest, setDevGuest] = useState(false);
  const isGuest = devGuest || (!isSignedIn && !DEV_FORCE_SIGNED_IN);

  const isPro = useIsPro();
  const search = useBrowseSearch({ isGuest, isPro });
  // Free accounts out of searches for the day (guests get GuestLimitGate).
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  useEffect(() => {
    if (search.limitReached && !isGuest) setLimitSheetOpen(true);
  }, [search.limitReached, isGuest]);
  const searchesLeftHint = !isGuest && !search.limitReached ? leftHint(search.left, "search", "searches") : null;
  // The intro, replayed on every visit to the tab (see usePageIntro): its
  // dot lands as the period of "Browse.". Leaving the tab puts the
  // header back at the top, ready for the next landing.
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Never with Reduce motion on (Settings, or the phone's own setting).
  const reduceMotion = useReduceMotion();
  const introOnce = useIntroOnce("browse");
  const intro = usePageIntro({
    enabled: SHOW_INTRO && !reduceMotion && introOnce.due,
    onArm: () => scrollRef.current?.scrollTo({ y: 0, animated: false }),
    onFinish: introOnce.markSeen,
  });
  // Where the search and filter row ends: the green header covers up to it.
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);
  // Dark green behind the clock over the header, white once the header has
  // scrolled up past it. Dark clock over the intro.
  // Green all the way: past the big header, the slim green bar takes over
  // under the clock (BrowseMiniHeader).
  const statusBar = useStatusBarStrip({ color: colors.home.top, darkUntil: Number.MAX_SAFE_INTEGER, forceDark: intro.showing });
  // Scroll position (the slim bar slides in from it) and the pull past the
  // top (0 to 1 at the refresh point) for the pot doodle.
  const scrollY = useSharedValue(0);
  const pull = useSharedValue(0);
  const [miniVisible, setMiniVisible] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    statusBar.onScroll(e);
    const y = e.nativeEvent.contentOffset.y;
    scrollY.value = y;
    pull.value = Math.max(0, -y) / PULL_DISTANCE;
    const shown = headerBottom != null && y > miniHeaderStart(headerBottom, statusBar.top) + 18;
    if (shown !== miniVisible) setMiniVisible(shown);
  };
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: realMealKeys.list }),
      new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
    ]);
    setRefreshing(false);
  };
  // Sections rise in one after another the first time (a plain fade with
  // Reduce motion).
  const [playEntrance] = useState(() => !entrancePlayed);
  useEffect(() => {
    entrancePlayed = true;
  }, []);
  const enter = (i: number) =>
    !playEntrance ? undefined : reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(i * 80).duration(420).easing(Easing.out(Easing.cubic));
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Today's pick: one real meal a day.
  const { meal: todaysPick } = useTodaysPick();
  const detail = useMealDetail();
  const savedMeals = useSavedMealActions();

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastError = (message: string) => setToast({ id: Date.now(), message, tone: "error" });


  // ---- login gates ----------------------------------------------------------

  const [gate, setGate] = useState<LoginGateReason | null>(null);
  // A guest's save is replayed once they're signed in (likes aren't).
  const pendingSave = useRef<MealType | null>(null);

  useEffect(() => {
    if (isGuest || !pendingSave.current) return;
    const meal = pendingSave.current;
    pendingSave.current = null;
    setGate(null);
    void savedMeals.save(meal);
    // Only on the guest -> signed-in transition.
  }, [isGuest]);

  const continueWith = async (provider: SignInProvider) => {
    // Forced-guest dev mode: "logging in" turns the override off.
    if (devGuest) return setDevGuest(false);
    try {
      await signIn.mutateAsync(provider);
    } catch {
      toastError("Sign-in didn't go through. Please try again.");
    }
  };

  const renderGate = (presentation: "modal" | "inline") => (
    <LoginGateSheet
      reason={gate}
      onClose={() => {
        setGate(null);
        pendingSave.current = null;
      }}
      onSignIn={continueWith}
      isSigningIn={signIn.isPending}
      presentation={presentation}
    />
  );

  const renderCard = (meal: MealType) => {
    const card = renderMealCard(meal);
    if (!search.isAvoided(meal)) return card;
    return (
      <AvoidedMealCover
        onView={() => detail.open(meal.id)}
        onManage={() => router.navigate({ pathname: "/profile/settings", params: { pro: "avoid" } })}
      >
        {card}
      </AvoidedMealCover>
    );
  };

  const renderMealCard = (meal: MealType) => (
    <MealCard
      meal={meal}
      isFastFood={meal.category === "fast_food"}
      showDescription
      onPress={() => detail.open(meal.id)}
      onViewDetails={() => detail.open(meal.id)}
      onBookmarkPress={
        isGuest
          ? () => {
              pendingSave.current = meal;
              setGate("save");
            }
          : undefined
      }
    />
  );

  if (isGuest && search.limitReached) {
    return (
      <Screen edges={["top"]}>
        <GuestLimitGate onSignIn={continueWith} signingIn={signIn.isPending} />
      </Screen>
    );
  }

  const detailMeal = detail.meal;
  const detailOpen = !!detailMeal;

  return (
    // Unpadded so the green header runs edge to edge; the scroll content
    // takes Screen's usual padding instead. No top edge: the content scrolls
    // under the status bar (behind statusBar.strip), starting below it.
    <Screen edges={[]} padded={false} dismissKeyboardOnTap={false}>
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-white"
        contentContainerClassName="px-7 pb-2"
        contentContainerStyle={{ paddingTop: statusBar.top + 8 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          // The native spinner is hidden; the pot doodle shows instead.
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="transparent" colors={["transparent"]} progressBackgroundColor="transparent" />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <HeaderBackdrop bottom={headerBottom} curves={TAB_HEADER_CURVES} texture />
        {/* Just above the title: hidden under the status bar at rest, it comes
            into view below the clock as the page is pulled down. */}
        <PotRefreshDoodle pull={pull} refreshing={refreshing} top={statusBar.top - 46} />
        <View className="flex-row items-start justify-between">
          {/* "Browse." like the other pages; its period is where the intro's
              dot lands. The craving question moved under it. */}
          <View className="ml-3 mt-3 flex-1 pr-2">
            <LandingTitle dotRef={intro.targetRef} showDot={intro.landed} light>
              Browse
            </LandingTitle>
            <AppText variant="caption" className="text-white/80">
              What are you craving today?
            </AppText>
          </View>
          {__DEV__ && (
            <Pressable onPress={() => setDevGuest((prev) => !prev)} className="mt-3 rounded-full bg-web-ink/80 px-2 py-1">
              <Text className="font-inter-semibold text-sub text-white">DEV {devGuest ? "guest" : "signed in"}</Text>
            </Pressable>
          )}
        </View>

        <View className="ml-3">
          <CravingTagline light />
        </View>

        <View className="mt-3" onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          {/* One pill: search, then the filter button inside its right end.
              The shadow sits on a wrapper (the pill itself clips nothing, but
              keeps NativeWind's shadow class off the input's View). */}
          <View className="rounded-full bg-white shadow-md">
            <SearchBar
              className="bg-white"
              placeholder="Search meals, restaurants..."
              value={search.query}
              onChangeText={search.setQuery}
              onClear={() => search.setQuery("")}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              trailing={<FilterButton inline count={countFilters(search.applied)} onPress={() => setFiltersOpen(true)} />}
            />
          </View>
          {searchesLeftHint && <Text className="ml-1 mt-2 font-inter-regular text-small text-ink-subtle">{searchesLeftHint}</Text>}
        </View>

        {search.isSearchMode ? (
          <View className="mb-6 mt-6">
            <Text className="mb-1 font-inter-bold text-subheading text-web-ink">Search Results</Text>
            {!search.loading && search.results.length === 0 ? (
              <EmptyMealView />
            ) : (
              // Rows run edge to edge (past the screen's side padding).
              <View className="-mx-7 mt-2">
                <SearchResults results={search.results} loading={search.loading} renderCard={renderCard} />
              </View>
            )}
          </View>
        ) : (
          <>
            {todaysPick && (
              <Animated.View entering={enter(0)} className="mb-6 mt-6">
                <View className="mb-3 flex-row items-end justify-between">
                  <AppText variant="sectionTitle" dot>
                    Today&apos;s pick
                  </AppText>
                  <View className="mb-1 flex-row items-center gap-1">
                    <Clock color={colors.ink.subtle} size={12} strokeWidth={2.5} />
                    <Text className="font-inter-medium text-small text-ink-subtle">New pick in {hoursUntilNextPick()}h</Text>
                  </View>
                </View>
                <TodaysPickCard
                  meal={todaysPick}
                  onPress={() => detail.open(todaysPick.id)}
                  onBookmarkPress={
                    isGuest
                      ? () => {
                          pendingSave.current = todaysPick;
                          setGate("save");
                        }
                      : undefined
                  }
                />
              </Animated.View>
            )}

            <Animated.View entering={enter(1)} className="mb-7">
              <CravingChips onPick={search.setApplied} />
            </Animated.View>

            <Animated.View entering={enter(2)} className="mb-6">
              <MoodSelection onSelectMeal={(meal) => detail.open(meal.id)} />
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Any meal opened here (search results, Today's pick, moods), fetched
          with its ingredients on open. */}
      <MealDetailSheet
        meal={detailMeal}
        onClose={detail.close}
        onNotify={(message, tone) => setToast({ id: Date.now(), message, tone })}
        overlay={detailOpen ? renderGate("inline") : undefined}
      />
      {!detailOpen && renderGate("modal")}

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        applied={search.applied}
        onApply={search.setApplied}
      />

      <Toast toast={toast} onHide={() => setToast(null)} />
      <DailyLimitSheet
        visible={limitSheetOpen}
        what="searches"
        limit={search.limit}
        onClose={() => setLimitSheetOpen(false)}
        onOpenPro={() => router.push("/pro")}
      />
      {statusBar.strip}
      {headerBottom != null && (
        <BrowseMiniHeader
          scrollY={scrollY}
          headerBottom={headerBottom}
          top={statusBar.top}
          visible={miniVisible}
          onSearchPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      )}
      {/* Below the status bar, where it sat before the page went under it. */}
      {intro.showing && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: statusBar.top, left: 0, right: 0, bottom: 0 }}>
          <BrowseIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />
        </View>
      )}
    </Screen>
  );
}
