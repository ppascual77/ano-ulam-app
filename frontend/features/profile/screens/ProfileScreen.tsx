import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { Easing, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming, Extrapolation } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { ImageIcon, Plus, Settings, Trash2 } from "lucide-react-native";
import {
  Avatar,
  HeaderBackdrop,
  LandingTitle,
  Screen,
  TAB_HEADER_CURVES,
  Toast,
  useStatusBarStrip,
  type ToastState,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { RECIPE_LIMIT } from "@/api/recipes";
import { type SignInProvider, useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { CreateSheet, type CreateChoice } from "@/frontend/core/posts/components/CreateSheet";
import { CreatePostSheet } from "@/frontend/core/posts/components/CreatePostSheet";
import type { FoodPost, PostInput } from "@/api/posts";
import { usePostCount, useSavePost } from "@/frontend/core/posts/hooks/usePosts";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import {
  useAvatarActions,
  useMe,
  useMyRecipes,
  useMyBio,
  useUpdateBio,
} from "../hooks/useProfile";
import { HEADER_AVATAR, HEADER_NAME_CLASS, ProfileHeader } from "../components/ProfileHeader";
import { ProfileStats } from "../components/ProfileStats";
import { OWN_TABS, type ProfileTab } from "../components/ProfileTabBar";
import { ProfileScaffold } from "../components/ProfileScaffold";
import { GuestProfileView } from "../components/GuestProfileView";
import { SavedTab } from "../components/saved/SavedTab";
import { CreatedTab } from "../components/created/CreatedTab";
import { RecipeLimitSheet } from "../components/created/RecipeLimitSheet";
import { GroceryTab } from "../components/grocery/GroceryTab";
import { PantryTab } from "../components/pantry/PantryTab";
import { ProAvatarRing, ProName, ProNameBadge, proRingSize } from "@/frontend/core/pro/components/ProProfileFlair";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { MealPlanBanner } from "../components/MealPlanBanner";

// Signed out: the guest view (sign in / create account), like the web's.

// How long the Dropdown menu's fade-out takes before the photo picker opens.
const MENU_FADE_MS = 350;

const TAB_PARAMS: ProfileTab[] = ["saved", "recipes", "grocery", "pantry"];

// ---- The green header --------------------------------------------------
// Like Browse and Price Watch: the shared textured green curve under a light
// "Profile." title, its edge running through the middle of the avatar.
// Space between the title row and the avatar.
const HERO_GAP = 12;
// The white ring around the hero avatar (ProfileHeader's p-1), each side.
const AVATAR_RING = 4;
// How far below the dark edge's base TAB_HEADER_CURVES dips at the middle of
// the screen (its sweep worked out at x = width / 2).
const CURVE_DIP_AT_MIDDLE = 23;
// Scrolling: over this many px the avatar shrinks to AVATAR_MIN_SCALE and
// drifts up AVATAR_DRIFT px.
const AVATAR_SCROLL_RANGE = 140;
const AVATAR_MIN_SCALE = 0.85;
const AVATAR_DRIFT = 10;

// Own profile: header, Community Feed link, then sticky Saved / Created /
// Grocery / Pantry tabs. Deep link: /profile?tab=recipes|grocery|pantry.
// The official AnoUlam account gets the official profile instead (no
// users.is_official yet: only reachable through the DEV switch).
// The floating + : a small white liquid glass circle (iOS 26), the list
// showing softly through it as it scrolls past, with an orange +. Older
// iOS gets a frosted blur instead, Android a near-solid white. Fades in
// with Profile and dims a touch when pressed. It shrinks a little while
// scrolling down (out of the content's way) and comes back on scrolling up.
const LIQUID_GLASS = isLiquidGlassAvailable();
const FAB_SIZE = 48;
const FAB_CIRCLE = { borderRadius: FAB_SIZE / 2 };
const FAB_SHRUNK_SCALE = 0.82;
const FAB_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

function CreateFab({ onPress, shrunk }: { onPress: () => void; shrunk: boolean }) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    // Reduce motion: it stays put.
    scale.value = withTiming(shrunk && !reduceMotion ? FAB_SHRUNK_SCALE : 1, FAB_TIMING);
  }, [shrunk, reduceMotion, scale]);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fill = LIQUID_GLASS ? "bg-white/30" : Platform.OS === "ios" ? "bg-white/60" : "bg-white/95";
  return (
    // The shadow sits on this wrapper: the button's own overflow-hidden
    // (which rounds the glass) would clip it on iOS.
    <Animated.View entering={FadeIn.duration(220)} style={scaleStyle} className="absolute bottom-5 right-5 rounded-full shadow-sm">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Create a post or recipe"
        style={[{ width: FAB_SIZE, height: FAB_SIZE }, FAB_CIRCLE]}
        className={`items-center justify-center overflow-hidden border border-white/80 active:opacity-80 ${fill}`}
      >
        {LIQUID_GLASS ? (
          <GlassView glassEffectStyle="regular" isInteractive style={[StyleSheet.absoluteFill, FAB_CIRCLE]} />
        ) : (
          Platform.OS === "ios" && <BlurView intensity={30} tint="light" pointerEvents="none" style={[StyleSheet.absoluteFill, FAB_CIRCLE]} />
        )}
        <Plus color={colors.accent} size={22} strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}

// Top right: a small white circle, the same family as the avatar's camera
// badge and the floating +.
function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push("/profile/settings")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      className="h-9 w-9 items-center justify-center rounded-full border border-ink-emphasis/10 bg-white shadow-sm active:opacity-80"
    >
      <Settings color={colors.primary} size={18} strokeWidth={2} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const signIn = useSignIn();
  const me = useMe();
  const reduceMotion = useReduceMotion();

  const isGuest = !isSignedIn;

  const [tab, setTab] = useState<ProfileTab>(
    TAB_PARAMS.includes(params.tab as ProfileTab) ? (params.tab as ProfileTab) : "saved",
  );
  // Deep link, e.g. the "Saved to your Profile" toast's View:
  // /profile?tab=saved&at=<time>. `at` changes per visit, so the same link
  // works again after switching tabs here.
  useEffect(() => {
    if (params.at && TAB_PARAMS.includes(params.tab as ProfileTab)) setTab(params.tab as ProfileTab);
    // Only on a new visit.
  }, [params.at]);
  const bio = useMyBio();
  const isPro = useProStore((s) => s.isPro);
  const updateBio = useUpdateBio();
  const avatar = useAvatarActions();
  const recipes = useMyRecipes(me.id);
  // Same rule as Add a Recipe's limit check: rejected recipes don't count.
  const recipeCount = (recipes.data ?? []).filter((meal) => meal.status !== "rejected").length;
  const atRecipeLimit = recipeCount >= RECIPE_LIMIT;
  const savedCount = useSavedMeals().data?.length ?? 0;
  const postCount = usePostCount(me.id).data ?? 0;

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") => setToast({ id: Date.now(), message, tone });

  // ---- The green header and scroll effects ---------------------------------

  // Where the hero (avatar) starts, in the scroll content.
  const [heroTop, setHeroTop] = useState<number | null>(null);
  const avatarOuter = (isPro ? proRingSize(HEADER_AVATAR.hero) : HEADER_AVATAR.hero) + AVATAR_RING * 2;
  // The dark edge's base, set so the curve crosses the avatar's middle.
  const edgeBase = heroTop == null ? null : heroTop + avatarOuter / 2 - CURVE_DIP_AT_MIDDLE;
  const backdropBottom = edgeBase == null ? null : edgeBase / TAB_HEADER_CURVES.splitAt;
  // Clear over the textured green, then white with a dark clock once the
  // white page is under it (like Browse's).
  const statusBar = useStatusBarStrip({
    color: colors.home.top,
    darkUntil: edgeBase ?? 150,
    forceDark: isGuest,
    clearUntil: (edgeBase ?? 150) - 24,
  });

  const scrollY = useSharedValue(0);
  const avatarStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const p = interpolate(scrollY.value, [0, AVATAR_SCROLL_RANGE], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY: -AVATAR_DRIFT * p }, { scale: 1 - (1 - AVATAR_MIN_SCALE) * p }] };
  });

  // The floating +: shrinks while scrolling down, back on scrolling up.
  const [fabShrunk, setFabShrunk] = useState(false);
  const lastY = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    statusBar.onScroll(e);
    const y = e.nativeEvent.contentOffset.y;
    scrollY.value = y;
    const dy = y - lastY.current;
    lastY.current = y;
    if (Math.abs(dy) < 4) return;
    const shrink = dy > 0 && y > 40;
    if (shrink !== fabShrunk) setFabShrunk(shrink);
  };

  // ---- Profile photo: tap the avatar to change or remove it ----------------
  const pickAvatar = async () => {
    // The photo menu is a Modal still fading out: iOS won't present the
    // picker over a view that's being dismissed, so give it a moment.
    await new Promise((resolve) => setTimeout(resolve, MENU_FADE_MS));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      await avatar.upload.mutateAsync({ uri: asset.uri, width: asset.width, height: asset.height });
      showToast("Profile photo updated", "success");
    } catch {
      showToast("Couldn't update your photo. Please try again.");
    }
  };
  const removeAvatar = async () => {
    try {
      await avatar.remove.mutateAsync();
      showToast("Profile photo removed", "success");
    } catch {
      showToast("Couldn't remove your photo. Please try again.");
    }
  };
  const avatarItems = [
    {
      label: me.avatarUrl ? "Change photo" : "Choose a photo",
      icon: <ImageIcon color={colors.ink.normal} size={16} />,
      onPress: () => void pickAvatar(),
    },
    ...(me.avatarUrl
      ? [
          {
            label: "Remove photo",
            icon: <Trash2 color={colors.like} size={16} />,
            onPress: () => void removeAvatar(),
            destructive: true,
          },
        ]
      : []),
  ];

  // Bumped near the bottom of the Created tab: load more posts.
  const [loadMoreSignal, setLoadMoreSignal] = useState(0);

  // Back from Add a Recipe (or anywhere): the recipe list may have changed.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["recipes", "mine"] });
    }, [queryClient]),
  );

  const changeTab = (next: ProfileTab) => {
    setTab(next);
    if (next === "recipes") void queryClient.invalidateQueries({ queryKey: ["recipes", "mine"] });
  };

  // ---- Create: the floating + (or the Created tab's empty state) -----------

  const [createOpen, setCreateOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; editPost: FoodPost | null }>({ open: false, editPost: null });
  const savePost = useSavePost();
  const createChoice = useRef<CreateChoice | null>(null);

  const afterCreateClosed = () => {
    const choice = createChoice.current;
    createChoice.current = null;
    if (choice === "post") setComposer({ open: true, editPost: null });
    if (choice === "recipe") {
      if (atRecipeLimit) setLimitOpen(true);
      else router.push("/add-recipe");
    }
  };

  // A new post shows at the top of the Created tab.
  const submitPost = async (input: PostInput) => {
    try {
      // Reloads every post list from the top, this profile's included.
      await savePost(input, composer.editPost);
      setComposer({ open: false, editPost: null });
      setTab("recipes");
    } catch {
      showToast("Couldn't save your post. Please try again.");
    }
  };

  const signInWith = async (provider: SignInProvider) => {
    try {
      await signIn.mutateAsync(provider);
    } catch {
      showToast("Sign-in didn't go through. Please try again.");
    }
  };

  const avatarNode = (size: number) => <Avatar name={me.name} imageUri={me.avatarUrl ?? undefined} size={size} />;

  return (
    // Signed in, the page runs under the status bar (the green header
    // behind the clock, statusBar.strip over it once scrolled).
    <Screen padded={false} edges={isGuest ? ["top"] : []} dismissKeyboardOnTap={false}>
      {isGuest ? (
        <>
          <View className="flex-row items-center px-5 py-2">
            {/* A bottom nav tab, so a title instead of a back arrow. */}
            <LandingTitle>Profile</LandingTitle>
          </View>
          {/* flexGrow: the guest view fills the height so it can center its
              pitch and pin its actions (still scrolls on short screens). */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <GuestProfileView onSignIn={signInWith} signingIn={signIn.isPending} />
          </ScrollView>
        </>
      ) : (
        <ProfileScaffold
          stickyTop={statusBar.top}
          onScroll={onScroll}
          header={
            <View>
              <HeaderBackdrop bottom={backdropBottom} curves={TAB_HEADER_CURVES} texture />
              <View style={{ paddingTop: statusBar.top + 8 }} className="flex-row items-start justify-between px-5">
                {/* "Profile." like the other tabs' titles, light on the green. */}
                <View className="ml-3 mt-3">
                  <LandingTitle light>Profile</LandingTitle>
                </View>
                <View className="mt-3">
                  <SettingsButton />
                </View>
              </View>
              <View style={{ marginTop: HERO_GAP }} onLayout={(e) => setHeroTop(e.nativeEvent.layout.y)}>
                <ProfileHeader
                  hero
                  avatarStyle={avatarStyle}
                  name={me.name}
                  avatarUrl={me.avatarUrl}
                  bio={bio}
                  // Pro: the ring, the badge and the name's glint (ProProfileFlair).
                  avatar={
                    isPro ? (
                      <ProAvatarRing size={HEADER_AVATAR.hero}>{avatarNode(HEADER_AVATAR.hero)}</ProAvatarRing>
                    ) : undefined
                  }
                  badge={isPro ? <ProNameBadge /> : undefined}
                  nameNode={isPro ? <ProName name={me.name} className={HEADER_NAME_CLASS.hero} /> : undefined}
                  avatarItems={avatarItems}
                  avatarBusy={avatar.busy}
                  onSaveBio={async (next) => {
                    try {
                      await updateBio.mutateAsync(next);
                      return true;
                    } catch {
                      showToast("Couldn't save your bio. Please try again.");
                      return false;
                    }
                  }}
                >
                  <ProfileStats
                    stats={[
                      { label: "Saved", value: savedCount, onPress: () => changeTab("saved") },
                      { label: "Recipes", value: recipeCount, onPress: () => changeTab("recipes") },
                      { label: "Posts", value: postCount, onPress: () => changeTab("recipes") },
                    ]}
                  />
                </ProfileHeader>
              </View>
              {/* While a meal plan runs today (same as Home's plan card). */}
              <MealPlanBanner />
            </View>
          }
          tabs={OWN_TABS}
          activeTab={tab}
          onTabChange={changeTab}
          miniName={me.name}
          miniAvatar={avatarNode}
          onNearEnd={() => tab === "recipes" && setLoadMoreSignal((n) => n + 1)}
        >
          {tab === "saved" && <SavedTab onToast={showToast} />}
          {tab === "recipes" && (
            <CreatedTab
              posterId={me.id}
              canCreate={!atRecipeLimit}
              onCreate={() => setCreateOpen(true)}
              onEditPost={(post) => setComposer({ open: true, editPost: post })}
              loadMoreSignal={loadMoreSignal}
              onToast={showToast}
            />
          )}
          {tab === "grocery" && <GroceryTab userId={me.id} />}
          {tab === "pantry" && <PantryTab />}
        </ProfileScaffold>
      )}

      <CreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onChoose={(choice) => {
          createChoice.current = choice;
          setCreateOpen(false);
        }}
        onClosed={afterCreateClosed}
      />
      <CreatePostSheet
        visible={composer.open}
        onClose={() => setComposer({ open: false, editPost: null })}
        editPost={composer.editPost}
        author={{ name: me.name, avatarUrl: me.avatarUrl }}
        onSubmit={submitPost}
      />
      <RecipeLimitSheet visible={limitOpen} onClose={() => setLimitOpen(false)} />

      {!isGuest && statusBar.strip}
      <Toast toast={toast} onHide={() => setToast(null)} />
      {/* Create (post or recipe), floating at the lower right: the same
          Create sheet as Discover's +. Signed-in members only. */}
      {!isGuest && <CreateFab onPress={() => setCreateOpen(true)} shrunk={fabShrunk} />}
    </Screen>
  );
}
