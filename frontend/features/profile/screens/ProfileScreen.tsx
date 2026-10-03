import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Settings, UserCog } from "lucide-react-native";
import { Dropdown, Screen, Spinner, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { RECIPE_LIMIT } from "@/api/recipes";
import { useAuth, useSignInWithGoogle, useSignOut } from "@/frontend/features/auth/hooks/useAuth";
import { CreateSheet, type CreateChoice } from "@/frontend/core/posts/components/CreateSheet";
import { CreatePostSheet } from "@/frontend/core/posts/components/CreatePostSheet";
import { createPost, updatePost, type FoodPost, type PostInput } from "@/frontend/core/posts/mock/posts";
import { useMe, useMyRecipes, useProfileExtras, useUpdateBio } from "../hooks/useProfile";
import { ProfileHeader } from "../components/ProfileHeader";
import { CommunityFeedLink } from "../components/CommunityFeedLink";
import { ProfileTabBar, type ProfileTab } from "../components/ProfileTabBar";
import { ProfileFooter } from "../components/ProfileFooter";
import { GuestProfileView } from "../components/GuestProfileView";
import { SavedTab } from "../components/saved/SavedTab";
import { CreatedTab } from "../components/created/CreatedTab";
import { RecipeLimitSheet } from "../components/created/RecipeLimitSheet";
import { GroceryTab } from "../components/grocery/GroceryTab";
import { PantryTab } from "../components/pantry/PantryTab";

// TEMP (dev only): show the signed-in profile without a session, since
// Google sign-in can't complete in Expo Go on a device. The DEV chip in
// the top bar flips to the guest view. Remove once sign-in is reliable.
const DEV_FORCE_SIGNED_IN = __DEV__;

// How close to the bottom (px) the Created tab starts loading more posts.
const LOAD_MORE_DISTANCE = 400;
const LOG_OUT_DELAY_MS = 2000;

const TAB_PARAMS: ProfileTab[] = ["saved", "recipes", "grocery", "pantry"];

// Own profile: header, Community Feed link, then sticky Saved / Created /
// Grocery / Pantry tabs. Deep link: /profile?tab=recipes|grocery|pantry.
export default function ProfileScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();
  const { isSignedIn } = useAuth();
  const signIn = useSignInWithGoogle();
  const signOut = useSignOut();
  const me = useMe();

  const [devGuest, setDevGuest] = useState(false);
  const isGuest = devGuest || (!isSignedIn && !DEV_FORCE_SIGNED_IN);

  const [tab, setTab] = useState<ProfileTab>(
    TAB_PARAMS.includes(params.tab as ProfileTab) ? (params.tab as ProfileTab) : "saved",
  );
  const extras = useProfileExtras();
  const updateBio = useUpdateBio();
  const recipes = useMyRecipes(me.id);
  // Same rule as Add a Recipe's limit check: rejected recipes don't count.
  const recipeCount = (recipes.data ?? []).filter((meal) => meal.status !== "rejected").length;
  const atRecipeLimit = recipeCount >= RECIPE_LIMIT;

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") => setToast({ id: Date.now(), message, tone });

  // ---- sticky tab bar + infinite posts -----------------------------------

  const [tabBarY, setTabBarY] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [loadMoreSignal, setLoadMoreSignal] = useState(0);
  const nearEnd = useRef(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const nextStuck = tabBarY > 0 && contentOffset.y >= tabBarY;
    if (nextStuck !== stuck) setStuck(nextStuck);
    // Signal once per arrival near the bottom, not on every scroll event.
    const isNearEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height) < LOAD_MORE_DISTANCE;
    if (isNearEnd && !nearEnd.current && tab === "recipes") setLoadMoreSignal((n) => n + 1);
    nearEnd.current = isNearEnd;
  };

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

  // ---- Create: "+" (Created tab or mini header), chooser, composer ---------

  const [createOpen, setCreateOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; editPost: FoodPost | null }>({ open: false, editPost: null });
  const [postsRefreshKey, setPostsRefreshKey] = useState(0);
  const createChoice = useRef<CreateChoice | null>(null);
  // A post made from the mini header lands on Discover's Community tab; one
  // made from the Created tab refreshes the list here.
  const createdFromMiniHeader = useRef(false);

  const openCreate = (fromMiniHeader: boolean) => {
    createdFromMiniHeader.current = fromMiniHeader;
    setCreateOpen(true);
  };

  const afterCreateClosed = () => {
    const choice = createChoice.current;
    createChoice.current = null;
    if (choice === "post") setComposer({ open: true, editPost: null });
    if (choice === "recipe") {
      if (atRecipeLimit) setLimitOpen(true);
      else router.push("/add-recipe");
    }
  };

  const submitPost = async (input: PostInput) => {
    const editing = !!composer.editPost;
    try {
      if (composer.editPost) await updatePost(composer.editPost.id, input);
      else await createPost(input, { display_name: me.name, avatar_url: me.avatarUrl });
      setComposer({ open: false, editPost: null });
      if (!editing && createdFromMiniHeader.current) {
        router.navigate({ pathname: "/discover", params: { tab: "community", at: String(Date.now()) } });
        return;
      }
      setTab("recipes");
      setPostsRefreshKey((key) => key + 1);
    } catch {
      showToast("Couldn't save your post. Please try again.");
    }
  };

  // ---- account menu --------------------------------------------------------

  const [loggingOut, setLoggingOut] = useState(false);
  const logOut = () => {
    setLoggingOut(true);
    setTimeout(async () => {
      try {
        if (isSignedIn) await signOut.mutateAsync();
      } finally {
        router.replace("/home");
      }
    }, LOG_OUT_DELAY_MS);
  };

  const signInWithGoogle = async () => {
    try {
      await signIn.mutateAsync();
    } catch {
      showToast("Sign-in didn't go through. Please try again.");
    }
  };

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="h-9 w-9 justify-center">
          <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
        <View className="flex-row items-center gap-3">
          {__DEV__ && (
            <Pressable onPress={() => setDevGuest((prev) => !prev)} className="rounded-full bg-web-ink/80 px-2 py-1">
              <Text className="font-inter-semibold text-sub text-white">DEV {devGuest ? "guest" : "signed in"}</Text>
            </Pressable>
          )}
          {!isGuest && (
            <Dropdown
              trigger={
                <View accessibilityLabel="Account menu" className="h-9 w-9 items-center justify-center">
                  <Settings color={colors.webInk.DEFAULT} size={20} />
                </View>
              }
              items={[
                {
                  label: "Profile Settings",
                  icon: <UserCog color={colors.webInk.muted} size={14} />,
                  onPress: () => showToast("Settings are coming soon", "success"),
                },
                { label: "Log out", icon: <LogOut color={colors.like} size={14} />, onPress: logOut, destructive: true },
              ]}
            />
          )}
        </View>
      </View>

      {isGuest ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <GuestProfileView
            onSignIn={signInWithGoogle}
            onCreateAccount={() => router.push("/signup")}
            signingIn={signIn.isPending}
          />
          <ProfileFooter />
        </ScrollView>
      ) : (
        <ScrollView
          stickyHeaderIndices={[1]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View className="pb-4">
            <ProfileHeader
              name={me.name}
              avatarUrl={me.avatarUrl}
              bio={extras.data?.bio ?? null}
              onSaveBio={async (bio) => {
                try {
                  await updateBio.mutateAsync(bio);
                } catch {
                  showToast("Couldn't save your bio. Please try again.");
                }
              }}
            />
            <CommunityFeedLink
              onPress={() =>
                router.navigate({ pathname: "/discover", params: { tab: "community", at: String(Date.now()) } })
              }
            />
          </View>

          <View onLayout={(e) => setTabBarY(e.nativeEvent.layout.y)}>
            <ProfileTabBar
              active={tab}
              onChange={changeTab}
              stuck={stuck}
              name={me.name}
              onCreate={() => openCreate(true)}
            />
          </View>

          {/* At least a screen tall, so switching to a short tab doesn't
              yank the scroll position. */}
          <View className="px-5 pt-4" style={{ minHeight: windowHeight * 0.6 }}>
            {tab === "saved" && <SavedTab onToast={showToast} />}
            {tab === "recipes" && (
              <CreatedTab
                posterId={me.id}
                canCreate={!atRecipeLimit}
                onCreate={() => openCreate(false)}
                onEditPost={(post) => setComposer({ open: true, editPost: post })}
                postsRefreshKey={postsRefreshKey}
                loadMoreSignal={loadMoreSignal}
                onToast={showToast}
              />
            )}
            {tab === "grocery" && <GroceryTab userId={me.id} />}
            {tab === "pantry" && <PantryTab />}
          </View>

          <ProfileFooter />
        </ScrollView>
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

      {loggingOut && (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-white">
          <Spinner size={28} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />
          <Text className="font-inter-medium text-body text-web-ink-muted">Logging out...</Text>
        </View>
      )}

      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
