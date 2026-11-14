import { Text } from "@/frontend/components/ui/Text";
import { openPrivacyPolicy, openTerms } from "@/frontend/core/app/legalLinks";

// "By continuing, you agree to our Terms of Service and Privacy Policy",
// under every sign-in button, linking the pages on anoulam.app.
export function TermsLine({ tone = "light" }: { tone?: "light" | "dark" }) {
  const base = tone === "dark" ? "text-white/60" : "text-ink-subtle";
  const link = tone === "dark" ? "text-white" : "text-primary";
  return (
    <Text className={`text-center font-inter-regular text-small leading-5 ${base}`}>
      By continuing, you agree to our{" "}
      <Text onPress={openTerms} className={`font-inter-semibold ${link}`}>
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text onPress={openPrivacyPolicy} className={`font-inter-semibold ${link}`}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
