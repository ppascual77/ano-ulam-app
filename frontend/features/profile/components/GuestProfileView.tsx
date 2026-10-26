import { Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { GoogleSignInButton } from "@/frontend/features/auth/components/GoogleSignInButton";

// One per Profile tab a guest is missing out on.
const BENEFITS = ["Save your favorite meals", "Share your own recipes", "Keep a grocery list", "Track your pantry"];

type GuestProfileViewProps = {
  onSignIn: () => void;
  signingIn?: boolean;
};

// Profile while logged out, in the app's own style (the onboarding account
// pitch's look). Google is the only way in (signing in with it also creates
// the account), so one button.
export function GuestProfileView({ onSignIn, signingIn = false }: GuestProfileViewProps) {
  const reduceMotion = useReduceMotion();

  return (
    <View className="gap-6 px-5 pb-10 pt-4">
      <View className="items-center gap-3">
        {/* Held on its first frame under reduce motion. */}
        <Image
          source={require("@/assets/onboarding/slide-6.gif")}
          style={{ width: 180, height: 180 }}
          contentFit="contain"
          autoplay={!reduceMotion}
        />
        <AppText variant="sectionSubtitle" dot>
          Sign in to AnoUlam
        </AppText>
        <AppText variant="caption" className="text-center">
          It's free, and your meals and lists stay with you on any device.
        </AppText>
      </View>

      <View className="gap-3 rounded-2xl border border-ink-emphasis/10 px-5 py-4">
        {BENEFITS.map((benefit) => (
          <View key={benefit} className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
              <Check color={colors.white} size={14} />
            </View>
            <AppText variant="body" className="flex-1">
              {benefit}
            </AppText>
          </View>
        ))}
      </View>

      <GoogleSignInButton onPress={onSignIn} signingIn={signingIn} />

      <Text className="text-center font-inter-regular text-body leading-5 text-ink-subtle">
        By continuing, you agree to our{" "}
        <Text onPress={() => router.push("/terms")} className="font-inter-semibold text-primary">
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text onPress={() => router.push("/privacy")} className="font-inter-semibold text-primary">
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}
