import { ReactNode } from "react";
import { View } from "react-native";

type NoticeBannerProps = {
  icon: ReactNode;
  children: ReactNode;
  /** "notice" (default): amber, bordered — for disclaimers/warnings.
   *  "positive": soft green, no border — for calm reassurance notes. */
  tone?: "notice" | "positive";
};

// Icon + text row in a tinted rounded box (e.g. a meal card's price note,
// Budget's "Personalize your suggestions" prompt, Preferences' save note).
export function NoticeBanner({ icon, children, tone = "notice" }: NoticeBannerProps) {
  const isPositive = tone === "positive";

  return (
    <View
      className={`flex-row gap-2 rounded-xl px-4 py-6 items-center ${
        isPositive ? "bg-notice-positive-bg" : "border border-notice-border bg-notice-bg"
      }`}
    >
      {icon}
      <View className="flex-1">{children}</View>
    </View>
  );
}
