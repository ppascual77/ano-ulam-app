import { Text, View } from "react-native";
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
  const pills: PillType[] = getMealPills(meal);

  return (
    <View className="flex-row gap-1.5">
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
          <View
            key={i}
            className="flex-row items-center rounded-full px-2 py-2"
            style={{ backgroundColor: pill.bgColor }}
          >
            <Icon color="#FFFFFF" strokeWidth={1} size={14} />
            <Text className="ml-1 font-inter-regular text-caption text-white">{pill.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
