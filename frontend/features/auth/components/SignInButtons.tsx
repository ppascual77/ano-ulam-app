import { Platform, View } from "react-native";
import { Image } from "expo-image";
import { Button } from "@/frontend/components/ui";
import type { SignInProvider } from "../hooks/useAuth";
import { GoogleSignInButton } from "./GoogleSignInButton";

type SignInButtonsProps = {
  onSignIn: (provider: SignInProvider) => void;
  signingIn?: boolean;
  /** "glass" over moving art (onboarding); "social" everywhere else. */
  variant?: "social" | "glass";
};

// The ways to sign up or log in (no email/password): every guest gate, the
// login sheet and onboarding use this pair so they always match. Apple sits
// on top and only on iOS; it keeps Apple's black logo and black label on a
// light button, the same size as Google, which their guidelines allow.
export function SignInButtons({ onSignIn, signingIn = false, variant = "social" }: SignInButtonsProps) {
  return (
    <View className="gap-3">
      {Platform.OS === "ios" && (
        <Button
          label="Continue with Apple"
          variant={variant}
          disabled={signingIn}
          icon={<Image source={require("@/assets/icons/apple-logo.png")} style={{ width: 18, height: 18 }} contentFit="contain" />}
          onPress={() => onSignIn("apple")}
        />
      )}
      <GoogleSignInButton onPress={() => onSignIn("google")} signingIn={signingIn} variant={variant} />
    </View>
  );
}
