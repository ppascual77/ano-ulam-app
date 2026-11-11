import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { type SignInProvider, useAuth, useSignIn } from "@/frontend/features/auth/hooks/useAuth";
import { useMe, useUserProfile } from "../hooks/useProfile";
import { BackRow } from "../components/BackRow";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileScaffold } from "../components/ProfileScaffold";
import { VISITOR_TABS, type ProfileTab } from "../components/ProfileTabBar";
import { ProfileGate } from "../components/visitor/ProfileGate";
import { VisitorSavedTab } from "../components/visitor/VisitorSavedTab";
import { VisitorCreatedTab } from "../components/visitor/VisitorCreatedTab";
import { MealGridSkeleton } from "../components/MealGridSkeleton";

// Header placeholder while the profile loads.
function HeaderSkeleton() {
  return (
    <View className="flex-row items-center gap-4 px-5 pt-5">
      <View className="h-16 w-16 rounded-full bg-web-divider" />
      <View className="flex-1 gap-2">
        <View className="h-4 w-36 rounded bg-web-divider" />
        <View className="h-3 w-24 rounded bg-web-divider" />
      </View>
    </View>
  );
}

// /profile/<userId>: someone else's profile, read-only. Saved + Created
// tabs (opens on Created). Your own id redirects to your own profile.
export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { isSignedIn } = useAuth();
  const signIn = useSignIn();
  const me = useMe();
  const isGuest = !isSignedIn;
  const isMe = userId === me.id;

  const profile = useUserProfile(userId, isGuest);
  const [tab, setTab] = useState<ProfileTab>("recipes");
  const [loadMoreSignal, setLoadMoreSignal] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "error") => setToast({ id: Date.now(), message, tone });

  useEffect(() => {
    if (isMe) router.replace("/profile");
  }, [isMe]);

  const logIn = async (provider: SignInProvider) => {
    try {
      await signIn.mutateAsync(provider);
    } catch {
      showToast("Sign-in didn't go through. Please try again.");
    }
  };

  const unauthorized = profile.error instanceof Error && profile.error.message === "unauthorized";
  const name = profile.data?.display_name ?? "User";

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <BackRow />
      {isGuest || unauthorized ? (
        <ProfileGate onSignIn={logIn} signingIn={signIn.isPending} />
      ) : (
        <ProfileScaffold
          header={
            profile.data ? (
              <ProfileHeader name={name} avatarUrl={profile.data.avatar_url} bio={profile.data.bio} />
            ) : (
              <HeaderSkeleton />
            )
          }
          tabs={VISITOR_TABS}
          activeTab={tab}
          onTabChange={setTab}
          miniName={name}
          onNearEnd={() => tab === "recipes" && setLoadMoreSignal((n) => n + 1)}
        >
          {tab === "recipes" && <VisitorCreatedTab userId={userId} loadMoreSignal={loadMoreSignal} onToast={showToast} />}
          {tab === "saved" &&
            (profile.data ? <VisitorSavedTab profile={profile.data} onToast={showToast} /> : <MealGridSkeleton />)}
        </ProfileScaffold>
      )}
      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
