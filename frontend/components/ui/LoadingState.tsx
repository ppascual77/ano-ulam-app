import { ActivityIndicator, View } from "react-native";
import { AppText } from "./AppText";
import { colors } from "@/frontend/constants/theme";

type LoadingStateProps = {
  label?: string;
};

// Full-bleed centered spinner for a screen/section waiting on a query
// (e.g. useMeals() before its first successful fetch).
export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-12">
      <ActivityIndicator color={colors.primary} size="large" />
      {label && <AppText variant="caption">{label}</AppText>}
    </View>
  );
}
