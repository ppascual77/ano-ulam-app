import { Image, Text, View, useWindowDimensions } from "react-native";
import { SignInPrompt } from "@/frontend/features/auth/components/SignInPrompt";

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
export function GuestLimitGate({ onSignIn, signingIn = false }: { onSignIn: () => void; signingIn?: boolean }) {
  return (
    <View className="flex-1 justify-center">
      <SignInPrompt
        art={require("@/assets/onboarding/slide-1.gif")}
        title="Explore more meals"
        description="That's today's free searches. Sign in to keep searching, save your favorites and track your nutrition."
        onSignIn={onSignIn}
        signingIn={signingIn}
      />
    </View>
  );
}
