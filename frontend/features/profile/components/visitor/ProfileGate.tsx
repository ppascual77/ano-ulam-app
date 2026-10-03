import { Pressable, Text, View } from "react-native";
import { CircleUserRound } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type ProfileGateProps = {
  onCreateAccount: () => void;
  onLogIn: () => void;
};

// A guest opening someone's profile: sign in first.
export function ProfileGate({ onCreateAccount, onLogIn }: ProfileGateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-web-divider">
        <CircleUserRound color={colors.brandGreen.DEFAULT} size={28} />
      </View>
      <View className="items-center">
        <Text className="font-inter-bold text-heading text-web-ink">View this profile</Text>
        <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
          Sign in to see community members' profiles and their published recipes.
        </Text>
      </View>
      <Pressable onPress={onCreateAccount} className="w-full max-w-[320px] items-center rounded-2xl bg-brand-green py-3">
        <Text className="font-inter-semibold text-body text-white">Create account</Text>
      </Pressable>
      <Text className="font-inter-regular text-body text-web-ink-muted">
        Already have an account?{" "}
        <Text onPress={onLogIn} className="font-inter-semibold text-brand-green">
          Log in
        </Text>
      </Text>
    </View>
  );
}
