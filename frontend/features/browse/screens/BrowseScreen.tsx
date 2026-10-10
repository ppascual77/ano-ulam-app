import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { AppText, LandingTitle, Screen, SearchBar, Toast, usePageIntro, type ToastState } from "@/frontend/components/ui";
import { CravingTagline } from "@/frontend/features/browse/components/CravingTagline";
import { MoodSelection } from "@/frontend/features/browse/components/MoodSelection";
import { TodaysPickCard } from "@/frontend/core/meals/components/card/TodaysPickCard";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { useAuth, useSignInWithGoogle } from "@/frontend/features/auth/hooks/useAuth";
import { LoginGateSheet, type LoginGateReason } from "@/frontend/features/auth/components/LoginGateSheet";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useBrowseSearch } from "../hooks/useBrowseSearch";
import { countFilters } from "../utils/filters";
import { FilterButton } from "../components/FilterButton";
import { FilterSheet } from "../components/FilterSheet";
import { SearchResults } from "../components/SearchResults";
import { EmptyMealView, GuestLimitGate } from "../components/EmptyStates";
import { BrowseIntro } from "../components/BrowseIntro";

const todaysPick = mockMeals.find((meal) => meal.normalized_name === "bananaandpeanutbutter");

// TEMP (dev only): act signed in without a session (Google sign-in can't
// complete in Expo Go on a device). The DEV pill flips to guest, to test
// the login gates and the 3-searches-a-day limit. Remove with the others.
const DEV_FORCE_SIGNED_IN = __DEV__;

// Plays the "what are you craving" intro on moving to Browse.
// TODO: gate this behind a first-time-user flag (the auto tour), e.g. a
// stored "seen" flag, instead of always.
const SHOW_INTRO = true;

type LikeEntry = { liked: boolean; count: number };

// Browse: the default view (Today's pick, moods) until the user searches or
// filters, then "Search Results" grouped into Luto / Snacks / Fast food
// rows from the real catalog. Guests get login gates for like/save and 3
// searches a day.
export default function BrowseScreen() {
  const { isSignedIn } = useAuth();
  const signIn = useSignInWithGoogle();
  const [devGuest, setDevGuest] = useState(false);
  const isGuest = devGuest || (!isSignedIn && !DEV_FORCE_SIGNED_IN);

  const search = useBrowseSearch({ isGuest });
  // The intro, replayed on every visit to the tab (see usePageIntro): its
  // dot lands as the period of "Browse.". Leaving the tab puts the
  // header back at the top, ready for the next landing.
  const scrollRef = useRef<ScrollView>(null);
  // Never with Reduce motion on (Settings, or the phone's own setting).
  const reduceMotion = useReduceMotion();
  const intro = usePageIntro({ enabled: SHOW_INTRO && !reduceMotion, onArm: () => scrollRef.current?.scrollTo({ y: 0, animated: false }) });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const detail = useMealDetail();
  const savedMeals = useSavedMealActions();

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastSaved = (meal: MealType, saved: boolean) =>
    setToast({
      id: Date.now(),
      message: `${meal.name} ${saved ? "saved" : "removed"}`,
      tone: "success",
      image: resolveMealImage(meal),
      action: { label: "See it now", onPress: () => router.push("/profile") },
    });
  const toastError = (message: string) => setToast({ id: Date.now(), message, tone: "error" });

  // ---- likes: shared by the cards and Meal Details, so they stay in sync.
  // No like backend yet: local only.
  const [likes, setLikes] = useState<Record<string, LikeEntry>>({});
  const likeOf = (meal: MealType): LikeEntry =>
    (meal.id && likes[meal.id]) || { liked: meal.liked_by_me ?? false, count: meal.like_count ?? 0 };
  const toggleLike = (meal: MealType) => {
    if (!meal.id) return;
    if (isGuest) return setGate("like");
    const current = likeOf(meal);
    setLikes((prev) => ({
      ...prev,
      [meal.id as string]: { liked: !current.liked, count: Math.max(0, current.count + (current.liked ? -1 : 1)) },
    }));
  };

  // ---- login gates ----------------------------------------------------------

  const [gate, setGate] = useState<LoginGateReason | null>(null);
  // A guest's save is replayed once they're signed in (likes aren't).
  const pendingSave = useRef<MealType | null>(null);

  useEffect(() => {
    if (isGuest || !pendingSave.current) return;
    const meal = pendingSave.current;
    pendingSave.current = null;
    setGate(null);
    void savedMeals.save(meal).then((error) => (error ? toastError(error) : toastSaved(meal, true)));
    // Only on the guest -> signed-in transition.
  }, [isGuest]);

  const continueWithGoogle = async () => {
    // Forced-guest dev mode: "logging in" turns the override off.
    if (devGuest) return setDevGuest(false);
    try {
      await signIn.mutateAsync();
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
      onContinueWithGoogle={continueWithGoogle}
      isSigningIn={signIn.isPending}
      presentation={presentation}
    />
  );

  const renderCard = (meal: MealType) => (
    <MealCard
      meal={meal}
      isFastFood={meal.category === "fast_food"}
      showDescription
      onPress={() => detail.open(meal.id)}
      onViewDetails={() => detail.open(meal.id)}
      like={{ ...likeOf(meal), onToggle: () => toggleLike(meal) }}
      onBookmarkPress={
        isGuest
          ? () => {
              pendingSave.current = meal;
              setGate("save");
            }
          : undefined
      }
      onSaveChange={(saved) => toastSaved(meal, saved)}
      onSaveError={toastError}
    />
  );

  if (isGuest && search.limitReached) {
    return (
      <Screen edges={["top"]}>
        <GuestLimitGate onCreateAccount={() => router.push("/signup")} onLogIn={continueWithGoogle} />
      </Screen>
    );
  }

  const detailMeal = detail.meal;
  const detailOpen = !!detailMeal;

  return (
    <Screen edges={["top"]} dismissKeyboardOnTap={false}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="flex-row items-start justify-between">
          {/* "Browse." like the other pages; its period is where the intro's
              dot lands. The craving question moved under it. */}
          <View className="ml-3 mt-3 flex-1 pr-2">
            <LandingTitle dotRef={intro.targetRef} showDot={intro.landed}>
              Browse
            </LandingTitle>
            <AppText variant="caption">What are you craving today?</AppText>
          </View>
          {__DEV__ && (
            <Pressable onPress={() => setDevGuest((prev) => !prev)} className="mt-3 rounded-full bg-web-ink/80 px-2 py-1">
              <Text className="font-inter-semibold text-sub text-white">DEV {devGuest ? "guest" : "signed in"}</Text>
            </Pressable>
          )}
        </View>

        <View className="ml-3">
          <CravingTagline />
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <SearchBar
            className="flex-1"
            placeholder="Search meals, restaurants..."
            value={search.query}
            onChangeText={search.setQuery}
            onClear={() => search.setQuery("")}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <FilterButton count={countFilters(search.applied)} onPress={() => setFiltersOpen(true)} />
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
              <View className="mb-6 mt-6">
                <AppText variant="title" className="mb-3">
                  Today&apos;s pick
                </AppText>
                <TodaysPickCard meal={todaysPick} onPress={() => setSelectedMeal(todaysPick)} />
              </View>
            )}

            <View className="mb-6">
              <MoodSelection onSelectMeal={setSelectedMeal} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Default view's mock meals (already complete). */}
      <MealDetailSheet meal={selectedMeal} onClose={() => setSelectedMeal(null)} />

      {/* A search result, fetched with its ingredients on open. */}
      <MealDetailSheet
        meal={detailMeal}
        onClose={detail.close}
        onNotify={(message, tone) => setToast({ id: Date.now(), message, tone })}
        like={detailMeal ? { ...likeOf(detailMeal), onToggle: () => toggleLike(detailMeal) } : undefined}
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
      {intro.showing && <BrowseIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />}
    </Screen>
  );
}
