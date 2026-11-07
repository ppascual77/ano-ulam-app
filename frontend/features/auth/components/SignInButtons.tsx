import { Platform, View } from "react-native";
import { Image } from "expo-image";
import { Button } from "@/frontend/components/ui";
import { GoogleSignInButton } from "./GoogleSignInButton";

type SignInButtonsProps = {
  onGoogle: () => void;
  onApple?: () => void;
  signingIn?: boolean;
};

// The ways to sign up or log in (no email/password): every guest gate, the
// login sheet and onboarding use this pair so they always match. Apple sits
// on top and only on iOS; it uses Apple's white-with-outline style (black
// logo, same size as Google), which their guidelines allow.
export function SignInButtons({ onGoogle, onApple, signingIn = false }: SignInButtonsProps) {
  return (
    <View className="gap-3">
      {Platform.OS === "ios" && (
        <Button
          label="Continue with Apple"
          variant="social"
          disabled={signingIn}
          icon={<Image source={require("@/assets/icons/apple-logo.png")} style={{ width: 18, height: 18 }} contentFit="contain" />}
          onPress={onApple ?? (() => {})}
        />
      )}
      <GoogleSignInButton onPress={onGoogle} signingIn={signingIn} />
    </View>
  );
}
