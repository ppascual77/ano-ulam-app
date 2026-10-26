import { Image } from "expo-image";
import { Button } from "@/frontend/components/ui";

type GoogleSignInButtonProps = {
  onPress: () => void;
  signingIn?: boolean;
};

// The one way to sign up or log in (no email/password): every guest gate,
// the login sheet and onboarding use this. Apple goes next to it once
// Sign in with Apple is built.
export function GoogleSignInButton({ onPress, signingIn = false }: GoogleSignInButtonProps) {
  return (
    <Button
      label={signingIn ? "Signing in..." : "Continue with Google"}
      variant="social"
      disabled={signingIn}
      icon={<Image source={require("@/assets/icons/google-logo.png")} style={{ width: 18, height: 18 }} contentFit="contain" />}
      onPress={onPress}
    />
  );
}
