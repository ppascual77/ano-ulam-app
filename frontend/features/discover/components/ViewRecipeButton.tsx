import { ActivityIndicator, Pressable, Text } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Outlined, full-width button at the bottom of the reel. Opens the active
// meal's full MealDetailSheet. `loading` while that meal's ingredients load.
export function ViewRecipeButton({ onPress, loading = false }: { onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="h-12 flex-row items-center justify-center rounded-2xl border border-white"
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Text className="font-inter-semibold text-body text-white">View Recipe</Text>
          <ChevronRight color={colors.white} size={16} style={{ position: "absolute", right: 16 }} />
        </>
      )}
    </Pressable>
  );
}
