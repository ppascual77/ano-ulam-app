import { Text, View } from "react-native";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import type { SignInProvider } from "../hooks/useAuth";
import { SignInButtons } from "./SignInButtons";

export type LoginGateReason = "save" | "create";

// Copy from the web app's SaveMealLoginPrompt. The second half of the title
// is colored (orange for save, green for create).
const COPY: Record<LoginGateReason, { title: string; highlight: string; tone: string; description: string }> = {
  save: {
    title: "Don't lose ",
    highlight: "this meal!",
    tone: "text-brand-orange",
    description: "Log in to save your favorites, track your macros, and get your grocery list sorted automatically.",
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
  onSignIn: (provider: SignInProvider) => void;
  isSigningIn: boolean;
  /** "inline" when shown on top of another open sheet (e.g. a guest liking
   *  from inside MealDetailSheet): pass it through that sheet's `overlay`,
   *  since two native Modals don't stack reliably. */
  presentation?: "modal" | "inline";
  /** Fires once the close animation finishes (see BottomSheet's onClosed). */
  onClosed?: () => void;
};

// Shown when a guest tries a logged-in action. Uses the app's real Apple /
// Google sign-in; the screen replays the pending action once a session appears.
export function LoginGateSheet({
  reason,
  onClose,
  onSignIn,
  isSigningIn,
  presentation = "modal",
  onClosed,
}: LoginGateSheetProps) {
  const copy = COPY[reason ?? "save"];

  return (
    <BottomSheet
      visible={!!reason}
      onClose={onClose}
      onClosed={onClosed}
      heightPercent={0.7}
      presentation={presentation}
      fitContent
    >
      <View className="px-10 pb-10 pt-12">
        {/* The highlight ends in "!" or "?", so no orange dot after it. */}
        <AppText variant="sectionTitle">
          {copy.title}
          <Text className={copy.tone}>{copy.highlight}</Text>
        </AppText>
        <Text className="mt-3 font-inter-regular text-body text-web-ink-muted">{copy.description}</Text>
        <View className="mt-8">
          <SignInButtons onSignIn={onSignIn} signingIn={isSigningIn} />
        </View>
      </View>
    </BottomSheet>
  );
}
