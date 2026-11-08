import { View } from "react-native";
import { Image } from "expo-image";
import { Check } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { SignInButtons } from "@/frontend/features/auth/components/SignInButtons";
import type { SignInProvider } from "@/frontend/features/auth/hooks/useAuth";
import { TermsLine } from "@/frontend/features/auth/components/TermsLine";

// One per Profile tab a guest is missing out on.
const BENEFITS = ["Save your favorite meals", "Share your own recipes", "Keep a grocery list", "Track your pantry"];

type GuestProfileViewProps = {
  onSignIn: (provider: SignInProvider) => void;
  signingIn?: boolean;
};

// Profile while logged out, laid out like onboarding's closing pitch so the
// two read as one: art, title, one line of why, the benefits card, then the
// sign-in buttons and terms, all as one group centered on the screen.
// Signing in with Apple or Google also creates the account.
export function GuestProfileView({ onSignIn, signingIn = false }: GuestProfileViewProps) {
  const reduceMotion = useReduceMotion();

  return (
    <View className="flex-1 justify-center px-8 py-6">
      <View className="items-center">
        {/* Held on its first frame under reduce motion. */}
        <Image
          source={require("@/assets/onboarding/slide-6.gif")}
          style={{ width: 160, height: 160 }}
          contentFit="contain"
          autoplay={!reduceMotion}
        />
        <AppText variant="sectionTitle" dot className="mt-4 text-center">
          Sign in to AnoUlam
        </AppText>
        <AppText variant="caption" className="mt-2 max-w-[280px] text-center">
          It's free, and your meals and lists stay with you on any device.
        </AppText>

        <View className="mt-8 w-full gap-3.5 rounded-2xl border border-ink-emphasis/10 bg-white px-5 py-5">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check color={colors.white} size={12} strokeWidth={3} />
              </View>
              <AppText variant="body" className="flex-1">
                {benefit}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-8">
        <SignInButtons onSignIn={onSignIn} signingIn={signingIn} />
      </View>
      <View className="mt-4 max-w-[290px] self-center">
        <TermsLine />
      </View>
    </View>
  );
}
