import { Pressable, Text, View } from "react-native";
import { User } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type GuestProfileViewProps = {
  onSignIn: () => void;
  onCreateAccount: () => void;
  signingIn?: boolean;
};

// Profile while logged out: a sign-in prompt.
export function GuestProfileView({ onSignIn, onCreateAccount, signingIn = false }: GuestProfileViewProps) {
  return (
    <View className="items-center gap-5 px-6 py-16">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-web-divider">
        <User color={colors.webInk.faint} size={40} />
      </View>
      <View className="items-center">
        <Text className="font-inter-bold text-subheading text-web-ink-body">Your Profile</Text>
        <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
          Sign in to save meals, track your nutrition, and more.
        </Text>
      </View>
      <View className="w-full max-w-[320px] gap-3">
        <Pressable
          onPress={onSignIn}
          disabled={signingIn}
          className={`items-center rounded-2xl bg-brand-green py-3 ${signingIn ? "opacity-60" : ""}`}
        >
          <Text className="font-inter-semibold text-body text-white">{signingIn ? "Signing in..." : "Sign in"}</Text>
        </Pressable>
        <Pressable onPress={onCreateAccount} className="items-center rounded-2xl border border-web-divider py-3">
          <Text className="font-inter-semibold text-body text-web-ink-body">Create account</Text>
        </Pressable>
      </View>
    </View>
  );
}
