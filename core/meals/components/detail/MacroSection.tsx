import { View } from "react-native";
import { colors } from "@/constants/theme";
import { DonutChart } from "./DonutChart";
import { MacroLegend } from "./MacroLegend";

type MacroSectionProps = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export function MacroSection({ calories, protein, carbs, fats }: MacroSectionProps) {
  const legendItems = [
    {
      label: "Protein",
      value: protein,
      color: colors.macro.protein,
      bgClassName: "bg-macro-protein/10",
      textClassName: "text-macro-protein",
    },
    {
      label: "Fat",
      value: fats,
      color: colors.macro.fats,
      bgClassName: "bg-macro-fats/10",
      textClassName: "text-macro-fats",
    },
    {
      label: "Carbs",
      value: carbs,
      color: colors.macro.carbs,
      bgClassName: "bg-macro-carbs/10",
      textClassName: "text-macro-carbs",
    },
  ];

  return (
    <View className="flex-row items-center gap-4">
      <DonutChart calories={calories} protein={protein} carbs={carbs} fats={fats} />
      <View className="flex-1 border-l border-ink-emphasis/10 pl-4">
        <MacroLegend items={legendItems} />
      </View>
    </View>
  );
}
