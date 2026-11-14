import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { PantryIngredient } from "../types";
import { PANTRY_GROUPS, type PantryGroup } from "../pantryGroups";
import { pantryName } from "../pantryName";

// When a neighbour is removed (or added), the rest slide into place.
const SETTLE = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

export const chipClassOf = (group: PantryGroup) => PANTRY_GROUPS.find((g) => g.key === group)!.chipClass;

// The chip's face (tint, name), without behaviour: also what flies into the
// Add Ingredients sheet's tray when something is added.
export function ChipFace({ name, group, trailing }: { name: string; group: PantryGroup; trailing?: ReactNode }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full py-2 pl-3.5 ${trailing ? "pr-1.5" : "pr-3.5"} ${chipClassOf(group)}`}>
      <Text className="font-inter-medium text-body text-ink-emphasis">{name}</Text>
      {trailing}
    </View>
  );
}

// One pantry ingredient: a chip tinted by its group (condiments, fresh
// foods, veggies, staples), named the way people say it ("Red onion", not
// "Onion, red, raw"), with a remove button when `onRemove` is given. Fades
// in/out; neighbours slide when it comes or goes. Shared by Home's pantry
// tabs and the Add Ingredients sheet so the two look the same.
export function PantryChip({
  item,
  group = "staples",
  onRemove,
  hidden = false,
}: {
  item: PantryIngredient;
  /** Unknown until the ingredient catalog loads: staples' tint. */
  group?: PantryGroup;
  /** Holds its place but stays invisible (the sheet's tray, while this
   *  chip is still flying in). */
  hidden?: boolean;
  /** Omitted: no remove button. */
  onRemove?: () => void;
}) {
  const reduce = useReduceMotion();
  const name = pantryName(item.name);
  const face = (
    <ChipFace
      name={name}
      group={group}
      trailing={
        onRemove && (
          // A 24px target around the small x, so it's easy to hit.
          <Pressable
            onPress={onRemove}
            hitSlop={6}
            accessibilityLabel={`Remove ${name}`}
            className="h-6 w-6 items-center justify-center rounded-full active:bg-ink-emphasis/10"
          >
            <X color={colors.ink.emphasis} size={14} />
          </Pressable>
        )
      }
    />
  );
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={reduce ? undefined : SETTLE}>
      <View style={hidden ? { opacity: 0 } : undefined}>{face}</View>
    </Animated.View>
  );
}
