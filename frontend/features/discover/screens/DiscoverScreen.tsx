import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, type ListViewToken } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp } from "lucide-react-native";
import { Spinner, Toast, isModalSheetOpen, usePageIntro, type ToastState } from "@/frontend/components/ui";
import { usePaysForPro } from "@/frontend/core/pro/store/useProStore";
import { allRewardsEarned, useProRewardProgress } from "@/frontend/core/pro/hooks/useProRewardProgress";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIntroOnce } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { colors } from "@/frontend/constants/theme";
import { getMeal } from "@/api/meals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { type SignInProvider, useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { useMyAvatarUrl } from "@/frontend/features/auth/hooks/useUserProfile";
import { mealKey, useDiscoverFeed } from "../hooks/useDiscoverFeed";
import { FeedTabs, type DiscoverTab } from "../components/FeedTabs";
import { ActionRail } from "../components/ActionRail";
import { MealDetailsOverlay } from "../components/MealDetailsOverlay";
import { ViewRecipeButton } from "../components/ViewRecipeButton";
import { GuestEndCard } from "../components/GuestEndCard";
import { LoginGateSheet, type LoginGateReason } from "@/frontend/features/auth/components/LoginGateSheet";
import { CommunityFeed } from "../components/CommunityFeed";
import { CreateButton } from "../components/CreateButton";
import { DiscoverIntro } from "../components/DiscoverIntro";
import { EarnProSheet, type EarnProChoice } from "../components/EarnProSheet";
import { canShowEarnProPrompt, useEarnProPromptStore } from "../store/useEarnProPromptStore";
import { CreateSheet, type CreateChoice } from "@/frontend/core/posts/components/CreateSheet";
import { CreatePostSheet } from "@/frontend/core/posts/components/CreatePostSheet";
import { openProfile } from "@/frontend/core/users/openProfile";
import type { FoodPost, PostInput } from "@/api/posts";
import { useSavePost } from "@/frontend/core/posts/hooks/usePosts";

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

// The + button's highlight waits this long after the intro hands off.
const HIGHLIGHT_AFTER_INTRO_MS = 350;

// Plays the "your turn, share it" intro on moving to Discover.
// TODO: gate this behind a first-time-user flag (the auto tour), e.g. a
// stored "seen" flag, instead of always.
const SHOW_INTRO = true;
// Reels watched in one visit before "Your recipe could earn you Pro" may show.
const EARN_PRO_AFTER_REELS = 6;

type Page = { kind: "meal"; meal: MealType } | { kind: "end" };

// A guest's save is remembered while they sign in, then replayed with
// the then-current handlers (not a stale closure).
type PendingAction = { type: "save"; meal: MealType } | { type: "create" };

// Discover: a full-screen, swipe-up reel of meals (Recipes tab), plus a
// Community tab (the food post feed). See the web app's
// DiscoverPage.tsx (mobile branch) for the original.
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, session } = useAuth();
  const signIn = useSignIn();

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

  // The intro, replayed on every visit to the tab (see usePageIntro): its
  // dot flies into the Create button, which swells and runs an orange lap
  // of its border.
  const reduceMotion = useReduceMotion();
  const introOnce = useIntroOnce("discover");
  const intro = usePageIntro({ enabled: SHOW_INTRO && !reduceMotion && introOnce.due, onFinish: introOnce.markSeen });
  const [createHighlight, setCreateHighlight] = useState(0);
  const finishIntro = () => {
    intro.finish();
    // A beat after the intro's layer has gone, so the whole swell and lap
    // play in the open (fired at once, they ran under it).
    setTimeout(() => setCreateHighlight((n) => n + 1), HIGHLIGHT_AFTER_INTRO_MS);
  };

  // Status bar follows the tab while Discover is focused (light over the
  // dark reel, dark over Community's white), and goes back to dark when
  // leaving: tab screens stay mounted, so a <StatusBar> element here would
  // leak its style onto the other tabs.
  // Light over the intro's black cover too, whichever tab is showing.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(tab === "recipes" || intro.showing ? "light" : "dark");
      return () => setStatusBarStyle("dark");
    }, [tab, intro.showing]),
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
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndexRef.current(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ---- save, with the guest login gate ------------------------------------

  const runAction = async (action: PendingAction) => {
    if (action.type === "create") {
      // Replayed after the login gate closes (see openCreateAfterGate), so
      // the Create sheet never opens while the gate's Modal is still up.
      openCreateAfterGate.current = true;
      return;
    }
    // Its feedback (toasts, errors included) comes from the saved actions.
    await feed.toggleSave(action.meal);
  };

  // ---- Create: button, chooser, composer ---------------------------------

  const savePost = useSavePost();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; editPost: FoodPost | null }>({
    open: false,
    editPost: null,
  });
  const [communityRefreshKey, setCommunityRefreshKey] = useState(0);
  const openCreateAfterGate = useRef(false);
  // What was picked in the Create sheet; acted on once it finishes closing.
  const createChoice = useRef<CreateChoice | null>(null);

  const meta = session?.user.user_metadata ?? {};
  const myAvatarUrl = useMyAvatarUrl();
  const author = {
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? "You",
    avatarUrl: myAvatarUrl,
  };

  // One tap opens the Create sheet. Guests get the "create" login gate
  // instead.
  const pressCreate = () => {
    if (isGuest) {
      pending.current = { type: "create" };
      setGate("create");
      return;
    }
    setCreateSheetOpen(true);
  };

  const afterCreateSheetClosed = () => {
    const choice = createChoice.current;
    createChoice.current = null;
    if (choice === "post") setComposer({ open: true, editPost: null });
    if (choice === "recipe") router.push("/add-recipe");
  };

  const submitPost = async (input: PostInput) => {
    try {
      // Reloads every post list from the top, so a new post shows first.
      await savePost(input, composer.editPost);
      setComposer({ open: false, editPost: null });
      // Land on Community.
      setTab("community");
    } catch {
      showToast("Couldn't save your post. Please try again.");
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

  const continueWith = async (provider: SignInProvider) => {
    // Forced-guest dev mode is already signed in: "logging in" just turns
    // the override off (which replays the pending action above).
    if (forceGuest && isSignedIn) {
      setForceGuest(false);
      return;
    }
    try {
      await signIn.mutateAsync(provider);
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
    // its cached pages).
    if (next === "recipes") {
      feed.reset();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  };

  // Deep link from Profile (Community Feed row, or a post made there):
  // /discover?tab=community&at=<time>. `at` changes per visit, so the same
  // link works again after the user has switched back to Recipes.
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  useEffect(() => {
    if (params.tab === "community" || params.tab === "recipes") changeTab(params.tab);
    if (params.tab === "community") setCommunityRefreshKey((key) => key + 1);
    // Only on a new visit.
  }, [params.at]);

  // ---- "Your recipe could earn you Pro" --------------------------------------
  // For signed-in free users, once they've watched EARN_PRO_AFTER_REELS reels
  // in one visit (they've just seen what others share), when nothing else is
  // open. At most once a day; gone for good after 3 dismissals (the store,
  // on the account). Never once every reward is earned.

  // Not for subscribers (earned days would overlap paid Pro); earned Pro
  // still sees it while a reward is left, since a second one stacks.
  const subscribed = usePaysForPro();
  const [earnProOpen, setEarnProOpen] = useState(false);
  const reelsSeen = useRef(new Set<number>());
  const userId = session?.user.id ?? null;
  const loadEarnPro = useEarnProPromptStore((s) => s.load);
  useEffect(() => {
    if (userId) void loadEarnPro(userId);
  }, [loadEarnPro, userId]);
  const rewardProgress = useProRewardProgress();
  // Counts per visit.
  useFocusEffect(
    useCallback(() => {
      reelsSeen.current = new Set();
    }, []),
  );
  useEffect(() => {
    if (tab !== "recipes" || isGuest || subscribed || !activeMeal) return;
    reelsSeen.current.add(feed.activeIndex);
    if (reelsSeen.current.size < EARN_PRO_AFTER_REELS) return;
    if (earnProOpen || intro.showing || detailOpen || gate || composer.open || createSheetOpen || isModalSheetOpen()) return;
    if (!userId || !canShowEarnProPrompt(userId)) return;
    // Wait for real progress, and skip it once there's nothing left to earn.
    if (!rewardProgress.data || allRewardsEarned(rewardProgress.data)) return;
    useEarnProPromptStore.getState().markShown();
    setEarnProOpen(true);
    // On each reel change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.activeIndex]);

  const afterEarnProClosed = (choice: EarnProChoice | null) => {
    if (choice === "recipe") router.push("/add-recipe");
    else if (choice === "post") setComposer({ open: true, editPost: null });
    else useEarnProPromptStore.getState().markDismissed();
  };


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
      onSignIn={continueWith}
      isSigningIn={signIn.isPending}
      presentation={presentation}
      onClosed={() => {
        if (!openCreateAfterGate.current) return;
        openCreateAfterGate.current = false;
        setCreateSheetOpen(true);
      }}
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
                    <GuestEndCard onSignIn={continueWith} signingIn={signIn.isPending} />
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
              <Spinner />
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
              {/* Only the poster row in the details block is tappable, so
                  touches elsewhere pass through to the pager: swiping over the
                  name/price/description still moves to the next meal. */}
              <View pointerEvents="box-none" className="absolute left-5" style={{ bottom: DETAILS_BOTTOM, right: 76 }}>
                <MealDetailsOverlay
                  key={activeKey}
                  meal={activeMeal}
                  onPressPoster={() => openProfile(activeMeal.poster_id, session?.user.id ?? null)}
                />
              </View>

              <View className="absolute right-4" style={{ bottom: RAIL_BOTTOM }}>
                <ActionRail
                  // Remount per meal, so the confetti only fires for a save
                  // made on this meal, not when swiping onto one.
                  key={activeKey}
                  saved={feed.isSaved(activeMeal)}
                  saveCount={feed.saveCountOf(activeMeal)}
                  busy={!!(activeKey && feed.inFlight[activeKey])}
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
          isGuest={isGuest}
          currentUserId={isGuest ? null : (session?.user.id ?? null)}
          topInset={insets.top + TABS_TOP_OFFSET + TABS_ROW_HEIGHT}
          onLogIn={continueWith}
          onToast={showToast}
          onEditPost={(post) => setComposer({ open: true, editPost: post })}
          refreshKey={communityRefreshKey}
        />
      )}

      {/* Tabs row, fixed on top of both tabs. */}
      {/* box-none: the full-width row itself passes touches through (so the
          area beside the pills still swipes); the pills stay tappable. */}
      {/* No background on either tab: on Community the posts scroll past
          under the (glass) tabs and the +. */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0 items-center"
        style={{
          paddingTop: insets.top + TABS_TOP_OFFSET,
          height: insets.top + TABS_TOP_OFFSET + TABS_ROW_HEIGHT,
        }}
      >
        <FeedTabs
          active={tab}
          onChange={changeTab}
          disabled={feed.status === "loading"}
          variant={tab === "recipes" ? "dark" : "light"}
        />
      </View>

      {/* Same top and height as the tabs capsule, so the + and the tabs
          share a center line. */}
      <View className="absolute right-4" style={{ top: insets.top + TABS_TOP_OFFSET }}>
        <CreateButton
          onPress={pressCreate}
          variant={tab === "recipes" ? "dark" : "light"}
          landingRef={intro.targetRef}
          highlightId={createHighlight}
        />
      </View>

      {__DEV__ && isSignedIn && (
        <Pressable
          onPress={() => setForceGuest((prev) => !prev)}
          className={`absolute left-3 rounded-full px-2 py-1 ${tab === "recipes" ? "bg-white/20" : "bg-web-ink/80"}`}
          // Below the tabs row, clear of the (left-shifted) tab pills.
          style={{ top: insets.top + TABS_TOP_OFFSET + TABS_ROW_HEIGHT + 4 }}
        >
          <Text className="font-inter-semibold text-sub text-white">DEV {forceGuest ? "guest" : "signed in"}</Text>
        </Pressable>
      )}

      <MealDetailSheet
        meal={detailOpen ? detailMeal : null}
        onClose={() => setDetailOpen(false)}
        overlay={detailOpen ? renderGate("inline") : undefined}
      />

      {!detailOpen && renderGate("modal")}

      <CreateSheet
        visible={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        onChoose={(choice) => {
          createChoice.current = choice;
          setCreateSheetOpen(false);
        }}
        onClosed={afterCreateSheetClosed}
      />

      <EarnProSheet
        visible={earnProOpen}
        progress={rewardProgress.data ?? null}
        onClose={() => setEarnProOpen(false)}
        onClosed={afterEarnProClosed}
      />

      <CreatePostSheet
        visible={composer.open}
        onClose={() => setComposer({ open: false, editPost: null })}
        editPost={composer.editPost}
        author={author}
        onSubmit={submitPost}
      />

      <Toast toast={toast} onHide={() => setToast(null)} />

      {intro.showing && <DiscoverIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={finishIntro} />}
    </View>
  );
}
