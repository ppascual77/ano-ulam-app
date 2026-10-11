import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { PantryIngredient } from "../mock/api";
import { PANTRY_GROUPS, type PantryGroup } from "../pantryGroups";

// One pantry ingredient: a chip tinted by its group (condiments, fresh
// foods, veggies, staples) with a remove button. Just fades in/out, no
// movement. Shared by Home's pantry tabs and the Add Ingredients sheet so
// the two look the same.
export function PantryChip({
  item,
  group = "staples",
  onRemove,
}: {
  item: PantryIngredient;
  /** Unknown until the ingredient catalog loads: staples' tint. */
  group?: PantryGroup;
  onRemove: () => void;
}) {
  const chipClass = PANTRY_GROUPS.find((g) => g.key === group)!.chipClass;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
      <View className={`flex-row items-center gap-2 rounded-full px-3.5 py-2 ${chipClass}`}>
        <Text className="font-inter-medium text-body text-ink-emphasis">{item.name}</Text>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${item.name}`}>
          <X color={colors.ink.emphasis} size={13} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
