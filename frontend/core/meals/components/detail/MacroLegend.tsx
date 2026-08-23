import { View } from "react-native";
import { AppText } from "@/frontend/components/ui";

type MacroLegendItem = {
  label: string;
  value: number;
  color: string;
  bgClassName: string;
  textClassName: string;
};

type MacroLegendProps = {
  items: MacroLegendItem[];
};

// Grams -> calories -> % of total, matching how macros are usually read.
function caloriesFor(label: string, value: number) {
  return label === "Fat" ? value * 9 : value * 4;
}

export function MacroLegend({ items }: MacroLegendProps) {
  const totalCalories = items.reduce((sum, item) => sum + caloriesFor(item.label, item.value), 0);
  const percentFor = (label: string, value: number) =>
    totalCalories ? Math.round((caloriesFor(label, value) / totalCalories) * 100) : 0;

  return (
    <View className="w-full gap-3">
      {items.map((item, index) => (
        <View key={item.label}>
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <AppText variant="caption">{item.label}</AppText>
            </View>
            <View className="flex-row items-center gap-2">
              <AppText variant="caption">{item.value}g</AppText>
              <View className={`rounded-lg px-2 py-0.5 ${item.bgClassName}`}>
                <AppText variant="caption" className={`text-sub ${item.textClassName}`}>
                  {percentFor(item.label, item.value)}%
                </AppText>
              </View>
            </View>
          </View>
          {index !== items.length - 1 && <View className="mt-2 border-b border-ink-emphasis/10" />}
        </View>
      ))}
    </View>
  );
}
