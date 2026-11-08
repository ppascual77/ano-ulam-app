import { View } from "react-native";
import { SignInPrompt } from "@/frontend/features/auth/components/SignInPrompt";
import type { SignInProvider } from "@/frontend/features/auth/hooks/useAuth";

type GuestEndCardProps = {
  onSignIn: (provider: SignInProvider) => void;
  signingIn?: boolean;
};

// Shown to guests as an extra full-screen page after the last meal (they
// get one batch, no infinite feed). Content only; the screen sizes it. On
// Discover's black feed, so the prompt's dark tone.
export function GuestEndCard({ onSignIn, signingIn = false }: GuestEndCardProps) {
  return (
    <View className="flex-1 justify-center">
      <SignInPrompt
        tone="dark"
        title="Keep exploring"
        description="Sign in for an endless feed, and to save the meals you like."
        onSignIn={onSignIn}
        signingIn={signingIn}
      />
    </View>
  );
}
