import { Text, View } from "react-native";
import { Image } from "expo-image";
import { BottomSheet, Button } from "@/frontend/components/ui";

export type LoginGateReason = "save" | "like" | "create";

// Copy from the web app's SaveMealLoginPrompt. The second half of the title
// is colored (orange for save/like, green for create).
const COPY: Record<LoginGateReason, { title: string; highlight: string; tone: string; description: string }> = {
  save: {
    title: "Don't lose ",
    highlight: "this meal!",
    tone: "text-brand-orange",
    description: "Log in to save your favorites, track your macros, and get your grocery list sorted automatically.",
  },
  like: {
    title: "Like this ",
    highlight: "meal?",
    tone: "text-brand-orange",
    description: "Log in to like meals, build your favorites list, and get personalized picks.",
  },
  create: {
    title: "Share with the ",
    highlight: "community!",
    tone: "text-brand-green",
    description: "Sign in to post food finds, share recipes, and join the conversation.",
  },
};

type LoginGateSheetProps = {
  /** null closes the sheet. */
  reason: LoginGateReason | null;
  onClose: () => void;
  onContinueWithGoogle: () => void;
  isSigningIn: boolean;
  /** "inline" when shown on top of another open sheet (e.g. a guest liking
   *  from inside MealDetailSheet): pass it through that sheet's `overlay`,
   *  since two native Modals don't stack reliably. */
  presentation?: "modal" | "inline";
};

// Shown when a guest tries a logged-in action. Uses the app's real Google
// sign-in; the screen replays the pending action once a session appears.
export function LoginGateSheet({
  reason,
  onClose,
  onContinueWithGoogle,
  isSigningIn,
  presentation = "modal",
}: LoginGateSheetProps) {
  const copy = COPY[reason ?? "save"];

  return (
    <BottomSheet visible={!!reason} onClose={onClose} heightPercent={0.7} presentation={presentation} fitContent>
      <View className="px-10 pb-10 pt-12">
        <Text className="font-inter-bold text-heading text-web-ink">
          {copy.title}
          <Text className={copy.tone}>{copy.highlight}</Text>
        </Text>
        <Text className="mt-3 font-inter-regular text-body text-web-ink-muted">{copy.description}</Text>
        <View className="mt-8">
          <Button
            label={isSigningIn ? "Signing in..." : "Continue with Google"}
            variant="social"
            disabled={isSigningIn}
            icon={<Image source={require("@/assets/icons/google-logo.png")} style={{ width: 18, height: 18 }} contentFit="contain" />}
            onPress={onContinueWithGoogle}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
