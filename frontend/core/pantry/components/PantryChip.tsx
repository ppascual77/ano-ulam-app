import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { PantryIngredient } from "../types";
import { PANTRY_GROUPS, type PantryGroup } from "../pantryGroups";
import { pantryName } from "../pantryName";

// One pantry ingredient: a chip tinted by its group (condiments, fresh
// foods, veggies, staples), named the way people say it ("Red onion", not
// "Onion, red, raw"), with a remove button when `onRemove` is given. Just fades in/out, no
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
  /** Omitted: no remove button (Home's pantry outside Edit). */
  onRemove?: () => void;
}) {
  const name = pantryName(item.name);
  const chipClass = PANTRY_GROUPS.find((g) => g.key === group)!.chipClass;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
      <View className={`flex-row items-center gap-2 rounded-full px-3.5 py-2 ${chipClass}`}>
        <Text className="font-inter-medium text-body text-ink-emphasis">{name}</Text>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${name}`}>
            <X color={colors.ink.emphasis} size={13} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
