import { View } from "react-native";
import { SignInPrompt } from "@/frontend/features/auth/components/SignInPrompt";
import type { SignInProvider } from "@/frontend/features/auth/hooks/useAuth";

type ProfileGateProps = {
  onSignIn: (provider: SignInProvider) => void;
  signingIn?: boolean;
};

// A guest opening someone's profile: sign in first.
export function ProfileGate({ onSignIn, signingIn = false }: ProfileGateProps) {
  return (
    <View className="flex-1 justify-center">
      <SignInPrompt
        art={require("@/assets/onboarding/slide-6.gif")}
        title="See this profile"
        description="Sign in to see community members' profiles and the recipes they've shared."
        onSignIn={onSignIn}
        signingIn={signingIn}
      />
    </View>
  );
}
