import { Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartPie } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Floating "Nutrition Overview" button over the own Saved tab (only when
// there's at least one saved meal). Slightly see-through until pressed.
export function NutritionOverviewFab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      className="absolute right-4 flex-row items-center gap-2 rounded-2xl bg-brand-green px-4 py-3 opacity-80 shadow-lg active:opacity-100"
      style={{ bottom: insets.bottom + 24 }}
    >
      <ChartPie color={colors.white} size={16} />
      <Text className="font-inter-semibold text-body text-white">Nutrition Overview</Text>
    </Pressable>
  );
}
