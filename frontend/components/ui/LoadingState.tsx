import { ActivityIndicator, View } from "react-native";
import { AppText } from "./AppText";
import { Spinner } from "./Spinner";
import { colors } from "@/frontend/constants/theme";

type LoadingStateProps = {
  label?: string;
  /** "spiral": the hand-drawn spinning spiral from the Save button's
   *  loading state, larger and in accent, for a section loading inline
   *  (e.g. the pantry) rather than a whole screen. */
  variant?: "default" | "spiral";
};

// The Save button's spiral is 16px; a section's is this.
const SPIRAL_SIZE = 64;

// Full-bleed centered spinner for a screen/section waiting on a query
// (e.g. useMeals() before its first successful fetch).
export function LoadingState({ label, variant = "default" }: LoadingStateProps) {
  if (variant === "spiral") {
    return (
      <View className="items-center justify-center gap-3 py-12" accessibilityRole="progressbar" accessibilityLabel={label}>
        <Spinner variant="spiral" size={SPIRAL_SIZE} color={colors.accent} />
        {label && <AppText variant="caption">{label}</AppText>}
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-3 py-12">
      <ActivityIndicator color={colors.primary} size="large" />
      {label && <AppText variant="caption">{label}</AppText>}
    </View>
  );
}
