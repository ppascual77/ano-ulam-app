import { Text } from "react-native";
import { router } from "expo-router";

// "By continuing, you agree to our Terms of Service and Privacy Policy",
// under every sign-in button, linking the in-app legal screens.
export function TermsLine({ tone = "light" }: { tone?: "light" | "dark" }) {
  const base = tone === "dark" ? "text-white/60" : "text-ink-subtle";
  const link = tone === "dark" ? "text-white" : "text-primary";
  return (
    <Text className={`text-center font-inter-regular text-small leading-4 ${base}`}>
      By continuing, you agree to our{" "}
      <Text onPress={() => router.push("/terms")} className={`font-inter-semibold ${link}`}>
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text onPress={() => router.push("/privacy")} className={`font-inter-semibold ${link}`}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
