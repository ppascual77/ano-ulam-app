import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react-native";
import { AppText, LandingTitle, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { RECIPE_LIMIT } from "@/api/recipes";
import { useAuth, useSignInWithGoogle } from "@/frontend/features/auth/hooks/useAuth";
import { CreateSheet, type CreateChoice } from "@/frontend/core/posts/components/CreateSheet";
import { CreatePostSheet } from "@/frontend/core/posts/components/CreatePostSheet";
import { createPost, updatePost, type FoodPost, type PostInput } from "@/frontend/core/posts/mock/posts";
import {
  useMe,
  useMyRecipes,
  useProfileExtras,
  useUpdateBio,
} from "../hooks/useProfile";
import { ProfileHeader } from "../components/ProfileHeader";
import { CommunityFeedLink } from "../components/CommunityFeedLink";
import { OWN_TABS, type ProfileTab } from "../components/ProfileTabBar";
import { ProfileScaffold } from "../components/ProfileScaffold";
import { OfficialProfileView } from "../components/official/OfficialProfileView";
import { GuestProfileView } from "../components/GuestProfileView";
import { SavedTab } from "../components/saved/SavedTab";
import { CreatedTab } from "../components/created/CreatedTab";
import { RecipeLimitSheet } from "../components/created/RecipeLimitSheet";
import { GroceryTab } from "../components/grocery/GroceryTab";
import { PantryTab } from "../components/pantry/PantryTab";

// Signed out: the guest view (sign in / create account), like the web's.
// Dev only: the DEV chip in the top bar cycles signed in -> official
// account -> guest, to preview the other views while signed in.
type DevAccount = "user" | "official" | "guest";
const NEXT_DEV_ACCOUNT: Record<DevAccount, DevAccount> = { user: "official", official: "guest", guest: "user" };
const DEV_ACCOUNT_LABEL: Record<DevAccount, string> = { user: "signed in", official: "official", guest: "guest" };


const TAB_PARAMS: ProfileTab[] = ["saved", "recipes", "grocery", "pantry"];

// Own profile: header, Community Feed link, then sticky Saved / Created /
// Grocery / Pantry tabs. Deep link: /profile?tab=recipes|grocery|pantry.
// The official AnoUlam account gets the official profile instead (no
// users.is_official yet: only reachable through the DEV switch).
export default function ProfileScreen() {
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const signIn = useSignInWithGoogle();
  const me = useMe();

  const [devAccount, setDevAccount] = useState<DevAccount>("user");
  const isGuest = !isSignedIn || devAccount === "guest";
  const isOfficial = !isGuest && devAccount === "official";

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
  const extras = useProfileExtras();
  const updateBio = useUpdateBio();
  const recipes = useMyRecipes(me.id);
  // Same rule as Add a Recipe's limit check: rejected recipes don't count.
  const recipeCount = (recipes.data ?? []).filter((meal) => meal.status !== "rejected").length;
  const atRecipeLimit = recipeCount >= RECIPE_LIMIT;

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") => setToast({ id: Date.now(), message, tone });

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
        {/* A bottom nav tab now, so a title instead of a back arrow. */}
        <LandingTitle>Profile</LandingTitle>
        <View className="flex-row items-center gap-3">
          {__DEV__ && (
            <Pressable onPress={() => setDevAccount((prev) => NEXT_DEV_ACCOUNT[prev])} className="rounded-full bg-web-ink/80 px-2 py-1">
              <Text className="font-inter-semibold text-sub text-white">DEV {DEV_ACCOUNT_LABEL[devAccount]}</Text>
            </Pressable>
          )}
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <GuestProfileView
            onSignIn={signInWithGoogle}
            onCreateAccount={() => router.push("/signup")}
            signingIn={signIn.isPending}
          />
        </ScrollView>
      ) : isOfficial ? (
        <OfficialProfileView onToast={showToast} />
      ) : (
        <ProfileScaffold
          header={
            <>
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
            </>
          }
          tabs={OWN_TABS}
          activeTab={tab}
          onTabChange={changeTab}
          miniName={me.name}
          onCreate={() => openCreate(true)}
          onNearEnd={() => tab === "recipes" && setLoadMoreSignal((n) => n + 1)}
        >
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
    </Screen>
  );
}
