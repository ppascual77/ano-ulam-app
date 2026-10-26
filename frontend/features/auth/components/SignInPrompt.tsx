import { Text, View } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/frontend/components/ui";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { TermsLine } from "./TermsLine";

type SignInPromptProps = {
  title: string;
  description: string;
  onSignIn: () => void;
  signingIn?: boolean;
  /** An onboarding GIF (held still under reduce motion). Light only: the
   *  GIFs have white backgrounds. */
  art?: number;
  /** "dark" for Discover's black feed. */
  tone?: "light" | "dark";
};

// A guest hitting something that needs an account (someone's profile,
// Browse's daily limit, the end of Discover's guest feed), in the app's own
// style: art, a dotted title, one line of why, the Google button, terms.
export function SignInPrompt({ title, description, onSignIn, signingIn = false, art, tone = "light" }: SignInPromptProps) {
  const reduceMotion = useReduceMotion();
  const dark = tone === "dark";
  return (
    <View className="w-full items-center gap-5 px-8">
      {art && !dark && <Image source={art} style={{ width: 170, height: 170 }} contentFit="contain" autoplay={!reduceMotion} />}
      <View className="items-center gap-1.5">
        {dark ? (
          <Text className="text-center font-inter-extrabold text-heading-sm tracking-display text-white">
            {title}
            <Text className="text-accent">.</Text>
          </Text>
        ) : (
          <AppText variant="sectionSubtitle" dot className="text-center">
            {title}
          </AppText>
        )}
        <Text className={`max-w-[300px] text-center font-inter-regular text-body leading-5 ${dark ? "text-white/70" : "text-ink-subtle"}`}>
          {description}
        </Text>
      </View>
      <View className="w-full max-w-[320px]">
        <GoogleSignInButton onPress={onSignIn} signingIn={signingIn} />
      </View>
      <TermsLine tone={tone} />
    </View>
  );
}
