import { Text, View } from "react-native";
import { User } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { GoogleSignInButton } from "@/frontend/features/auth/components/GoogleSignInButton";

type GuestProfileViewProps = {
  onSignIn: () => void;
  signingIn?: boolean;
};

// Profile while logged out: a sign-in prompt. Google is the only way in
// (signing in with it also creates the account), so one button.
export function GuestProfileView({ onSignIn, signingIn = false }: GuestProfileViewProps) {
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
      <View className="w-full max-w-[320px]">
        <GoogleSignInButton onPress={onSignIn} signingIn={signingIn} />
      </View>
    </View>
  );
}
