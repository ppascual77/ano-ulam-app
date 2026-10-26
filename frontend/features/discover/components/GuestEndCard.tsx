import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { GoogleSignInButton } from "@/frontend/features/auth/components/GoogleSignInButton";

type GuestEndCardProps = {
  onSignIn: () => void;
  signingIn?: boolean;
};

// Shown to guests as an extra full-screen page after the last meal (they
// get one batch, no infinite feed). Content only; the screen sizes it.
export function GuestEndCard({ onSignIn, signingIn = false }: GuestEndCardProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Sparkles color={colors.brandGreen.DEFAULT} size={28} />
      </View>
      <Text className="mt-5 text-center font-inter-bold text-heading text-white">Explore more meals</Text>
      <Text className="mt-2 text-center font-inter-regular text-body text-white/70">
        Sign up to unlock more discovery, save your favorites, and track your nutrition.
      </Text>
      <View className="mt-6 w-full">
        <GoogleSignInButton onPress={onSignIn} signingIn={signingIn} />
      </View>
    </View>
  );
}
