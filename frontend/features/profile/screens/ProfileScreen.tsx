import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { ImageIcon, Plus, Settings, Trash2 } from "lucide-react-native";
import { AppText, Avatar, LandingTitle, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { RECIPE_LIMIT } from "@/api/recipes";
import { type SignInProvider, useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { CreateSheet, type CreateChoice } from "@/frontend/core/posts/components/CreateSheet";
import { CreatePostSheet } from "@/frontend/core/posts/components/CreatePostSheet";
import type { FoodPost, PostInput } from "@/api/posts";
import { useSavePost } from "@/frontend/core/posts/hooks/usePosts";
import {
  useAvatarActions,
  useMe,
  useMyRecipes,
  useMyBio,
  useUpdateBio,
} from "../hooks/useProfile";
import { ProfileHeader } from "../components/ProfileHeader";
import { OWN_TABS, type ProfileTab } from "../components/ProfileTabBar";
import { ProfileScaffold } from "../components/ProfileScaffold";
import { GuestProfileView } from "../components/GuestProfileView";
import { SavedTab } from "../components/saved/SavedTab";
import { CreatedTab } from "../components/created/CreatedTab";
import { RecipeLimitSheet } from "../components/created/RecipeLimitSheet";
import { GroceryTab } from "../components/grocery/GroceryTab";
import { PantryTab } from "../components/pantry/PantryTab";
import { ProAvatarRing, ProName, ProNameBadge } from "@/frontend/core/pro/components/ProProfileFlair";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { MealPlanBanner } from "../components/MealPlanBanner";

// Signed out: the guest view (sign in / create account), like the web's.

// How long the Dropdown menu's fade-out takes before the photo picker opens.
const MENU_FADE_MS = 350;


const TAB_PARAMS: ProfileTab[] = ["saved", "recipes", "grocery", "pantry"];

// Own profile: header, Community Feed link, then sticky Saved / Created /
// Grocery / Pantry tabs. Deep link: /profile?tab=recipes|grocery|pantry.
// The official AnoUlam account gets the official profile instead (no
// users.is_official yet: only reachable through the DEV switch).
// The floating + : a small white liquid glass circle (iOS 26), the list
// showing softly through it as it scrolls past, with an orange +. Older
// iOS gets a frosted blur instead, Android a near-solid white. Fades in
// with Profile and dims a touch when pressed.
const LIQUID_GLASS = isLiquidGlassAvailable();
const FAB_SIZE = 48;
const FAB_CIRCLE = { borderRadius: FAB_SIZE / 2 };

function CreateFab({ onPress }: { onPress: () => void }) {
  const fill = LIQUID_GLASS ? "bg-white/30" : Platform.OS === "ios" ? "bg-white/60" : "bg-white/95";
  return (
    // The shadow sits on this wrapper: the button's own overflow-hidden
    // (which rounds the glass) would clip it on iOS.
    <Animated.View entering={FadeIn.duration(220)} className="absolute bottom-5 right-5 rounded-full shadow-sm">
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

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const signIn = useSignIn();
  const me = useMe();

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

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") => setToast({ id: Date.now(), message, tone });

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
      icon: <ImageIcon color={colors.webInk.soft} size={16} />,
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

  // ---- Create: "+" (Created tab or mini header), chooser, composer ---------

  const [createOpen, setCreateOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; editPost: FoodPost | null }>({ open: false, editPost: null });
  const savePost = useSavePost();
  const createChoice = useRef<CreateChoice | null>(null);
  // A post made from the mini header lands on Discover's Community tab; one
  // made from the Created tab shows at the top of the list here.
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
      // Reloads every post list from the top, this profile's included.
      await savePost(input, composer.editPost);
      setComposer({ open: false, editPost: null });
      if (!editing && createdFromMiniHeader.current) {
        router.navigate({ pathname: "/discover", params: { tab: "community", at: String(Date.now()) } });
        return;
      }
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

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <View className="flex-row items-center justify-between px-5 py-2">
        {/* A bottom nav tab now, so a title instead of a back arrow. */}
        <LandingTitle>Profile</LandingTitle>
        <View className="flex-row items-center gap-3">
          {!isGuest && (
            <Pressable
              onPress={() => router.push("/profile/settings")}
              hitSlop={8}
              accessibilityLabel="Settings"
              className="h-9 w-9 items-center justify-center"
            >
              <Settings color={colors.webInk.DEFAULT} size={20} />
            </Pressable>
          )}
        </View>
      </View>

      {isGuest ? (
        // flexGrow: the guest view fills the height so it can center its
        // pitch and pin its actions (still scrolls on short screens).
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <GuestProfileView
            onSignIn={signInWith}
            signingIn={signIn.isPending}
          />
        </ScrollView>
      ) : (
        <ProfileScaffold
          header={
            <>
              <ProfileHeader
                name={me.name}
                avatarUrl={me.avatarUrl}
                bio={bio}
                // Pro: the ring, the badge and "Pro since…" (ProProfileFlair).
                avatar={
                  isPro ? (
                    <ProAvatarRing size={64}>
                      <Avatar name={me.name} imageUri={me.avatarUrl ?? undefined} size={64} />
                    </ProAvatarRing>
                  ) : undefined
                }
                badge={isPro ? <ProNameBadge /> : undefined}
                nameNode={isPro ? <ProName name={me.name} className="font-inter-bold text-subheading text-web-ink" /> : undefined}
                avatarItems={avatarItems}
                avatarBusy={avatar.busy}
                onSaveBio={async (bio) => {
                  try {
                    await updateBio.mutateAsync(bio);
                  } catch {
                    showToast("Couldn't save your bio. Please try again.");
                  }
                }}
              />
              {/* While a meal plan runs today (same as Home's plan card). */}
              <MealPlanBanner />
            </>
          }
          tabs={OWN_TABS}
          activeTab={tab}
          onTabChange={changeTab}
          miniName={me.name}
          onNearEnd={() => tab === "recipes" && setLoadMoreSignal((n) => n + 1)}
        >
          {tab === "saved" && <SavedTab onToast={showToast} />}
          {tab === "recipes" && (
            <CreatedTab
              posterId={me.id}
              canCreate={!atRecipeLimit}
              onCreate={() => openCreate(false)}
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

      <Toast toast={toast} onHide={() => setToast(null)} />
      {/* Create (post or recipe), floating at the lower right: the same
          Create sheet as Discover's +. Signed-in members only. */}
      {!isGuest && <CreateFab onPress={() => openCreate(false)} />}
    </Screen>
  );
}
