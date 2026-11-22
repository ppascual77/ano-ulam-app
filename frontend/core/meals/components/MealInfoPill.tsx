import { View, useWindowDimensions } from "react-native";
import { Text, textLevel } from "@/frontend/components/ui/Text";
import getMealPills from "@/frontend/core/meals/utils/getMealPills";
import type { MealPillType, PillType } from "@/frontend/core/meals/mealTypes";

type MealInfoPillProps = {
  meal: MealPillType;
  iconOnly?: boolean;
  /** "reel": compact pill at 60% opacity, for text over a full-bleed photo
   *  (Discover). Defaults to the solid "card" look. */
  variant?: "card" | "reel";
};

// 60% opacity as a hex alpha suffix on the pill's #RRGGBB color.
const REEL_ALPHA = "99";

export function MealInfoPill({ meal, iconOnly = false, variant = "card" }: MealInfoPillProps) {
  const allPills: PillType[] = getMealPills(meal);
  // Bigger/Largest text: two labelled pills don't fit a card's width, so
  // only the first shows (BUG-5). Icon-only pills are small enough for both.
  const big = textLevel(useWindowDimensions().fontScale) > 0;
  const pills = big && !iconOnly && variant === "card" ? allPills.slice(0, 1) : allPills;

  return (
    <View className="min-w-0 shrink flex-row gap-1.5">
      {pills.map((pill, i) => {
        const Icon = pill.icon;

        if (iconOnly) {
          return (
            <View
              key={i}
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: pill.bgColor }}
            >
              <Icon color="#FFFFFF" strokeWidth={1.5} size={13} />
            </View>
          );
        }

        if (variant === "reel") {
          return (
            <View
              key={i}
              className="flex-row items-center rounded-xl px-2 py-1"
              style={{ backgroundColor: `${pill.bgColor}${REEL_ALPHA}` }}
            >
              <Icon color="#FFFFFF" strokeWidth={1.5} size={14} />
              <Text className="ml-1 font-inter-regular text-sub text-white">{pill.label}</Text>
            </View>
          );
        }

        return (
          // shrink + one line: a label that doesn't fit ends in "…" instead
          // of being cut off by the card's edge.
          <View
            key={i}
            className="min-w-0 shrink flex-row items-center rounded-full px-2 py-2"
            style={{ backgroundColor: pill.bgColor }}
          >
            <Icon color="#FFFFFF" strokeWidth={1} size={14} />
            <Text numberOfLines={1} className="ml-1 shrink font-inter-regular text-caption text-white">
              {pill.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
