import { Text, View } from "react-native";
import { Avatar } from "@/frontend/components/ui";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { ProAvatarRing } from "@/frontend/core/pro/components/ProProfileFlair";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { useMe } from "../../hooks/useProfile";

const AVATAR = 52;
const PROVIDER: Record<string, string> = { apple: "Apple", google: "Google" };

// The top of Settings: who you are and your tier (PRO, Free or Guest), at a
// glance. Dates and status (renews, trial, earned until) live only in the
// plan card under it, so they're never said twice. A Pro avatar wears the
// same accent ring as on your profile.
export function AccountCard() {
  const { session } = useAuth();
  const me = useMe();
  const isPro = useProStore((s) => s.isPro);

  const provider = PROVIDER[(session?.user.app_metadata?.provider as string | undefined) ?? ""];
  const avatar = <Avatar name={session ? me.name : "Guest"} imageUri={me.avatarUrl ?? undefined} size={AVATAR} />;

  return (
    <View className="flex-row items-center gap-3.5 rounded-3xl border border-ink-emphasis/10 px-4 py-3.5">
      {isPro ? <ProAvatarRing size={AVATAR}>{avatar}</ProAvatarRing> : avatar}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-inter-bold text-body-lg text-ink-emphasis">
          {session ? me.name : "Not signed in"}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 font-inter-regular text-small text-ink-subtle">
          {session ? (provider ? `Signed in with ${provider}` : session.user.email) : "Sign in to save meals and plans"}
        </Text>
      </View>
      {isPro ? (
        <ProBadge />
      ) : (
        <View className="rounded-full bg-ink-emphasis/5 px-2.5 py-1">
          <Text className="font-inter-bold text-sub text-ink-subtle">{session ? "Free" : "Guest"}</Text>
        </View>
      )}
    </View>
  );
}
