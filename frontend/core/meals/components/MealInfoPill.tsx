import { Text, View } from "react-native";
import getMealPills from "@/frontend/core/meals/utils/getMealPills";
import type { MealPillType, PillType } from "@/frontend/core/meals/mealTypes";

type MealInfoPillProps = {
  meal: MealPillType;
  iconOnly?: boolean;
};

export function MealInfoPill({ meal, iconOnly = false }: MealInfoPillProps) {
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
