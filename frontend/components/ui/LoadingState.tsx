import { ActivityIndicator, View } from "react-native";
import { AppText } from "./AppText";
import { Spinner } from "./Spinner";
import { colors } from "@/frontend/constants/theme";

type LoadingStateProps = {
  label?: string;
  /** "wave": the rolling accent squiggle from Button's loading state, larger,
   *  for a section loading inline (e.g. the pantry) rather than a whole
   *  screen. */
  variant?: "default" | "wave";
};

// Wave width: wide enough for a few full waves at the larger size.
const WAVE_WIDTH = 120;

// Full-bleed centered spinner for a screen/section waiting on a query
// (e.g. useMeals() before its first successful fetch).
export function LoadingState({ label, variant = "default" }: LoadingStateProps) {
  if (variant === "wave") {
    return (
      <View className="items-center justify-center gap-3 py-12" accessibilityRole="progressbar" accessibilityLabel={label}>
        <View style={{ width: WAVE_WIDTH }}>
          <Spinner variant="wave" size={20} color={colors.accent} />
        </View>
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
