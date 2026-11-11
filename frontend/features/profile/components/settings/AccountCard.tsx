import { Text, View } from "react-native";
import { Avatar } from "@/frontend/components/ui";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { ProAvatarRing } from "@/frontend/core/pro/components/ProProfileFlair";
import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { useMe } from "../../hooks/useProfile";

const AVATAR = 52;
const PROVIDER: Record<string, string> = { apple: "Apple", google: "Google" };
// "Dec 9": short enough for the plan pill.
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

// The top of Settings: who you are and which plan you're on, at a glance.
// A Pro avatar wears the same accent ring as on your profile.
export function AccountCard() {
  const { session } = useAuth();
  const me = useMe();
  const isPro = useProStore((s) => s.isPro);
  const subscription = useProStore((s) => s.subscription);
  const earnedUntil = useProStore((s) => s.earnedUntil);

  const provider = PROVIDER[(session?.user.app_metadata?.provider as string | undefined) ?? ""];
  const plan = !session
    ? "Guest"
    : subscription
      ? subscription.status === "trial"
        ? "Pro trial"
        : subscription.status === "cancelled"
          ? `Pro until ${shortDate(subscription.renewsAt)}`
          : `Pro · renews ${shortDate(subscription.renewsAt)}`
      : isPro && earnedUntil
        ? `Earned Pro · until ${shortDate(earnedUntil)}`
        : "Free plan";
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
      <View className={`rounded-full px-2.5 py-1 ${isPro ? "bg-accent/10" : "bg-ink-emphasis/5"}`}>
        <Text numberOfLines={1} className={`font-inter-bold text-sub ${isPro ? "text-accent" : "text-ink-subtle"}`}>
          {plan}
        </Text>
      </View>
    </View>
  );
}
