import { Pressable, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type GuestEndCardProps = {
  onCreateAccount: () => void;
  onLogIn: () => void;
};

// Shown to guests as an extra full-screen page after the last meal (they
// get one batch, no infinite feed). Content only; the screen sizes it.
export function GuestEndCard({ onCreateAccount, onLogIn }: GuestEndCardProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Sparkles color={colors.brandGreen.DEFAULT} size={28} />
      </View>
      <Text className="mt-5 text-center font-inter-bold text-heading text-white">Explore more meals</Text>
      <Text className="mt-2 text-center font-inter-regular text-body text-white/70">
        Sign up to unlock more discovery, save your favorites, and track your nutrition.
      </Text>
      <Pressable onPress={onCreateAccount} className="mt-6 w-full items-center rounded-2xl bg-brand-green py-3.5">
        <Text className="font-inter-semibold text-body text-white">Create account</Text>
      </Pressable>
      <Pressable onPress={onLogIn} className="mt-4">
        <Text className="font-inter-regular text-body text-white/70">
          Already have an account? <Text className="font-inter-semibold text-white underline">Log in</Text>
        </Text>
      </Pressable>
    </View>
  );
}
