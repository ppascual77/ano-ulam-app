import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, type ViewToken } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp } from "lucide-react-native";
import { Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getMeal } from "@/api/meals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAuth, useSignInWithGoogle } from "@/frontend/features/auth/hooks/useAuth";
import { mealKey, useDiscoverFeed } from "../hooks/useDiscoverFeed";
import { FeedTabs, type DiscoverTab } from "../components/FeedTabs";
import { ActionRail } from "../components/ActionRail";
import { MealDetailsOverlay } from "../components/MealDetailsOverlay";
import { ViewRecipeButton } from "../components/ViewRecipeButton";
import { GuestEndCard } from "../components/GuestEndCard";
import { LoginGateSheet, type LoginGateReason } from "../components/LoginGateSheet";
import { CommunityFeed } from "../components/CommunityFeed";
import { MOCK_ME_ID } from "../mock/posts";

// Gradient stops over the reel photo: top keeps the tabs legible, bottom
// keeps the meal details legible. Black at varying alpha (gradients need
// raw color strings, not classNames).
const TOP_GRADIENT = ["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"] as const;
const BOTTOM_GRADIENT = ["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.9)"] as const;

// Overlay positions, measured up from the bottom of the reel. The web app's
// values (176/148/92/16) assume its tab bar overlaps the screen; here the
// BottomNav sits below the screen instead, so they're shifted down by the
// web bar's ~56px.
const RAIL_BOTTOM = 120;
const DETAILS_BOTTOM = 92;
const VIEW_RECIPE_BOTTOM = 36;
const HINT_BOTTOM = 12;
// Tabs row: offset below the status bar, and the height reserved for it
// above the Community list.
const TABS_TOP_OFFSET = 12;
const TABS_ROW_HEIGHT = 44;

// TEMP (dev only): show the Community feed as if signed in, so the mock
// posts are visible without a working sign-in. Remove once real sign-in
// is reliable; the reel's guest/login behavior is unaffected.
const DEV_FORCE_COMMUNITY_SIGNED_IN = __DEV__;

type Page = { kind: "meal"; meal: MealType } | { kind: "end" };

// A guest's like/save is remembered while they sign in, then replayed with
// the then-current handlers (not a stale closure).
type PendingAction = { type: "like" | "save"; meal: MealType };

// Discover: a full-screen, swipe-up reel of meals (Recipes tab), plus a
// Community tab (Phase 2, placeholder for now). See the web app's
// DiscoverPage.tsx (mobile branch) for the original.
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const signIn = useSignInWithGoogle();

  // Dev-only: force the guest experience while signed in, to test the login
  // gates and end-card without signing out.
  const [forceGuest, setForceGuest] = useState(false);
  const isGuest = !isSignedIn || forceGuest;

  const [tab, setTab] = useState<DiscoverTab>("recipes");
  const feed = useDiscoverFeed({ isGuest });
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef<FlatList<Page>>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") =>
    setToast({ id: Date.now(), message, tone });

  const [gate, setGate] = useState<LoginGateReason | null>(null);
  const pending = useRef<PendingAction | null>(null);

  // Status bar follows the tab while Discover is focused (light over the
  // dark reel, dark over Community's white), and goes back to dark when
  // leaving: tab screens stay mounted, so a <StatusBar> element here would
  // leak its style onto the other tabs.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(tab === "recipes" ? "light" : "dark");
      return () => setStatusBarStyle("dark");
    }, [tab]),
  );

  const pages: Page[] = useMemo(() => {
    const mealPages: Page[] = feed.meals.map((meal) => ({ kind: "meal", meal }));
    // Guests get one batch, then the sign-up end-card as an extra page.
    return isGuest && mealPages.length > 0 ? [...mealPages, { kind: "end" }] : mealPages;
  }, [feed.meals, isGuest]);

  const activePage = pages[feed.activeIndex];
  const activeMeal = activePage?.kind === "meal" ? activePage.meal : null;
  const activeKey = activeMeal ? mealKey(activeMeal) : null;
  const isEndCard = activePage?.kind === "end";
  const isLastPage = feed.activeIndex >= pages.length - 1;

  // FlatList requires a stable onViewableItemsChanged; the ref forwards to
  // the current setter.
  const setActiveIndexRef = useRef(feed.setActiveIndex);
  setActiveIndexRef.current = feed.setActiveIndex;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndexRef.current(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ---- like / save, with the guest login gate ------------------------------

  const runAction = async (action: PendingAction) => {
    if (action.type === "like") {
      await feed.toggleLike(action.meal);
    } else {
      const error = await feed.toggleSave(action.meal);
      if (error) showToast(error);
    }
  };

  const handleAction = (action: PendingAction) => {
    if (isGuest) {
      pending.current = action;
      setGate(action.type);
      return;
    }
    void runAction(action);
  };

  // Replay the guest's pending action once they're signed in.
  useEffect(() => {
    if (isGuest || !pending.current) return;
    const action = pending.current;
    pending.current = null;
    setGate(null);
    void runAction(action);
    // Only on the guest -> signed-in transition.
  }, [isGuest]);

  const continueWithGoogle = async () => {
    // Forced-guest dev mode is already signed in: "logging in" just turns
    // the override off (which replays the pending action above).
    if (forceGuest && isSignedIn) {
      setForceGuest(false);
      return;
    }
    try {
      await signIn.mutateAsync();
    } catch {
      showToast("Sign-in didn't go through. Please try again.");
    }
  };

  // ---- View Recipe: full meal (with ingredients) in MealDetailSheet --------

  const [detailMealId, setDetailMealId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ["meals", "discover-detail", detailMealId],
    queryFn: () => getMeal(detailMealId as string),
    enabled: !!detailMealId,
  });
  const detailMeal = detailQuery.data ? mealRowToMealType(detailQuery.data, detailQuery.data.meal_ingredients) : null;

  const openRecipe = () => {
    if (!activeMeal?.id) return;
    setDetailMealId(activeMeal.id);
    setDetailOpen(true);
  };

  // ---- tabs ----------------------------------------------------------------

  const changeTab = (next: DiscoverTab) => {
    if (next === tab) return;
    setTab(next);
    // Back to Recipes starts a fresh shuffle from the top (Community keeps
    // nothing to refetch yet).
    if (next === "recipes") {
      feed.reset();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  };

  const likeEntry = activeKey ? feed.likes[activeKey] : undefined;

  const closeGate = () => {
    setGate(null);
    pending.current = null;
  };
  // While the meal sheet is open, the gate renders inside it (its overlay
  // slot) instead of as a second Modal on top.
  const renderGate = (presentation: "modal" | "inline") => (
    <LoginGateSheet
      reason={gate}
      onClose={closeGate}
      onContinueWithGoogle={continueWithGoogle}
      isSigningIn={signIn.isPending}
      presentation={presentation}
    />
  );

  return (
    <View
      className={`flex-1 ${tab === "recipes" ? "bg-black" : "bg-white"}`}
      onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
    >
      {tab === "recipes" ? (
        <>
          {feed.status === "ready" && pageHeight > 0 && (
            <FlatList
              ref={listRef}
              data={pages}
              keyExtractor={(page) => (page.kind === "meal" ? mealKey(page.meal) : "end-card")}
              renderItem={({ item }) => (
                <View style={{ height: pageHeight }}>
                  {item.kind === "meal" ? (
                    <Image source={resolveMealImage(item.meal)} style={{ flex: 1 }} contentFit="cover" />
                  ) : (
                    <GuestEndCard onCreateAccount={continueWithGoogle} onLogIn={continueWithGoogle} />
                  )}
                </View>
              )}
              pagingEnabled
              snapToInterval={pageHeight}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              windowSize={3}
            />
          )}

          {/* Overlays stay fixed while the photo pages underneath; only the
              details block changes (and fades in) per meal. */}
          <LinearGradient
            colors={TOP_GRADIENT}
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 128 }}
          />
          {activeMeal && (
            <LinearGradient
              colors={BOTTOM_GRADIENT}
              pointerEvents="none"
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: pageHeight * 0.6 }}
            />
          )}

          {feed.status === "loading" && (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator size="large" color={colors.white} />
            </View>
          )}

          {feed.status === "error" && (
            <View className="absolute inset-0 items-center justify-center px-8">
              <Text className="text-heading">🍽️</Text>
              <Text className="mt-3 font-inter-bold text-subheading text-white">Couldn't load meals</Text>
              <Text className="mt-1 text-center font-inter-regular text-body text-white/70">
                Check your connection and try again.
              </Text>
              <Pressable onPress={feed.retry} className="mt-5 rounded-full bg-brand-green px-6 py-2.5">
                <Text className="font-inter-semibold text-body text-white">Retry</Text>
              </Pressable>
            </View>
          )}

          {feed.status === "ready" && activeMeal && (
            <>
              {/* Nothing in the details block is tappable, so touches pass
                  through to the pager: swiping over the name/price/description
                  still moves to the next meal. */}
              <View pointerEvents="none" className="absolute left-5" style={{ bottom: DETAILS_BOTTOM, right: 76 }}>
                <MealDetailsOverlay key={activeKey} meal={activeMeal} />
              </View>

              <View className="absolute right-4" style={{ bottom: RAIL_BOTTOM }}>
                <ActionRail
                  liked={likeEntry?.liked ?? false}
                  likeCount={likeEntry?.count ?? 0}
                  saved={!!(activeKey && feed.saves[activeKey])}
                  busy={!!(activeKey && feed.inFlight[activeKey])}
                  onLike={() => handleAction({ type: "like", meal: activeMeal })}
                  onSave={() => handleAction({ type: "save", meal: activeMeal })}
                  // Same as the web app today: no share target yet.
                  onShare={() => {}}
                />
              </View>

              <View className="absolute left-5 right-5" style={{ bottom: VIEW_RECIPE_BOTTOM }}>
                <ViewRecipeButton onPress={openRecipe} loading={detailOpen && detailQuery.isLoading} />
              </View>
            </>
          )}

          {feed.status === "ready" && !isEndCard && !isLastPage && (
            <View pointerEvents="none" className="absolute left-0 right-0 flex-row items-center justify-center gap-1" style={{ bottom: HINT_BOTTOM }}>
              <ChevronUp color={colors.white} size={12} style={{ opacity: 0.4 }} />
              <Text className="font-inter-regular text-sub text-white/40">Swipe up for next meal</Text>
            </View>
          )}
        </>
      ) : (
        <CommunityFeed
          isGuest={isGuest && !DEV_FORCE_COMMUNITY_SIGNED_IN}
          // Mock posts aren't keyed to real Supabase user ids yet: the
          // signed-in user is the mock "me".
          currentUserId={isGuest && !DEV_FORCE_COMMUNITY_SIGNED_IN ? null : MOCK_ME_ID}
          topInset={insets.top + TABS_TOP_OFFSET + TABS_ROW_HEIGHT}
          onLogIn={continueWithGoogle}
          onToast={showToast}
        />
      )}

      {/* Tabs row, fixed on top of both tabs. */}
      {/* box-none: the full-width row itself passes touches through (so the
          area beside the pills still swipes); the pills stay tappable. */}
      {/* On Community the row gets a white background, so posts scrolling
          up behind it stay hidden. */}
      <View
        pointerEvents="box-none"
        className={`absolute left-0 right-0 top-0 items-center ${tab === "community" ? "bg-white" : ""}`}
        style={{ paddingTop: insets.top + TABS_TOP_OFFSET, height: insets.top + TABS_TOP_OFFSET + TABS_ROW_HEIGHT }}
      >
        <FeedTabs
          active={tab}
          onChange={changeTab}
          disabled={feed.status === "loading"}
          variant={tab === "recipes" ? "dark" : "light"}
        />
      </View>

      {__DEV__ && isSignedIn && (
        <Pressable
          onPress={() => setForceGuest((prev) => !prev)}
          className={`absolute left-3 rounded-full px-2 py-1 ${tab === "recipes" ? "bg-white/20" : "bg-web-ink/80"}`}
          style={{ top: insets.top + 16 }}
        >
          <Text className="font-inter-semibold text-sub text-white">DEV {forceGuest ? "guest" : "signed in"}</Text>
        </Pressable>
      )}

      <MealDetailSheet
        meal={detailOpen ? detailMeal : null}
        onClose={() => setDetailOpen(false)}
        overlay={detailOpen ? renderGate("inline") : undefined}
        like={
          detailMeal && feed.likes[mealKey(detailMeal)]
            ? {
                liked: feed.likes[mealKey(detailMeal)].liked,
                count: feed.likes[mealKey(detailMeal)].count,
                onToggle: () => handleAction({ type: "like", meal: detailMeal }),
              }
            : undefined
        }
      />

      {!detailOpen && renderGate("modal")}

      <Toast toast={toast} onHide={() => setToast(null)} />
    </View>
  );
}
