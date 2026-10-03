import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Sparkles } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// No results ("We're curating your meals"), or the in-page daily limit.
// The copy mentions budget because the web shares it with the budget
// suggester; kept as-is per the hand-off.
export function EmptyMealView({ limitReached = false }: { limitReached?: boolean }) {
  const { height } = useWindowDimensions();
  return (
    <View className="mx-10 items-center justify-center" style={{ minHeight: height * 0.4 }}>
      <Image source={require("@/assets/browse/empty-meal-hero.png")} style={{ width: 200, height: 200 }} />
      <Text className="my-2 text-center font-inter-bold text-subheading text-web-ink">
        {limitReached ? "You've hit your " : "We're "}
        <Text className="text-brand-orange">{limitReached ? "daily limit" : "curating"}</Text>
        {limitReached ? "" : " your meals"}
      </Text>
      <Text className="px-5 text-center font-inter-regular text-body text-web-ink-muted">
        {limitReached
          ? "Sign in to search meals without limits and save your favorites."
          : "More options for this budget and preference are on the way. Try adjusting your budget in the meantime."}
      </Text>
    </View>
  );
}

// Replaces the whole Browse screen once a guest uses up today's searches.
export function GuestLimitGate({ onCreateAccount, onLogIn }: { onCreateAccount: () => void; onLogIn: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-5 px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-web-divider">
        <Sparkles color={colors.brandGreen.DEFAULT} size={28} />
      </View>
      <Text className="text-center font-inter-bold text-heading text-web-ink">Explore more meals</Text>
      <Text className="max-w-[320px] text-center font-inter-regular text-body leading-6 text-web-ink-muted">
        Sign up to unlock endless discovery, save your favorites, and track your nutrition.
      </Text>
      <Pressable onPress={onCreateAccount} className="w-full max-w-[320px] items-center rounded-2xl bg-brand-green py-3">
        <Text className="font-inter-semibold text-body text-white">Create account</Text>
      </Pressable>
      <Text className="font-inter-regular text-body text-web-ink-muted">
        Already have an account?{" "}
        <Text onPress={onLogIn} className="underline">
          Log in
        </Text>
      </Text>
    </View>
  );
}
