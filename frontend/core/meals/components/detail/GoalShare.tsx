import { Text, View } from "react-native";
import type { NutritionGoals } from "@/api/auth";

type GoalShareProps = {
  goals: NutritionGoals;
  /** One serving's nutrition. */
  perServing: { calories: number; protein: number; carbs: number; fats: number };
};

const ROWS: { key: keyof NutritionGoals; label: string; value: (p: GoalShareProps["perServing"]) => number; bar: string; text: string }[] = [
  { key: "calories", label: "Calories", value: (p) => p.calories, bar: "bg-like", text: "text-like" },
  { key: "protein", label: "Protein", value: (p) => p.protein, bar: "bg-macro-protein", text: "text-macro-protein" },
  { key: "carbs", label: "Carbs", value: (p) => p.carbs, bar: "bg-macro-carbs", text: "text-macro-carbs" },
  { key: "fat", label: "Fat", value: (p) => p.fats, bar: "bg-macro-fats", text: "text-macro-fats" },
];

// Pro: how much of each daily nutrition goal (Settings) one serving covers.
// Per serving whatever the card shows, since a goal is one person's day.
export function GoalShare({ goals, perServing }: GoalShareProps) {
  const rows = ROWS.flatMap((row) => {
    const goal = goals[row.key];
    return goal ? [{ ...row, pct: Math.round((row.value(perServing) / goal) * 100) }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <View className="mt-3 gap-2 border-t border-ink-emphasis/10 pt-3">
      <Text className="font-inter-regular text-small text-ink-subtle">One serving, of your daily goals</Text>
      {rows.map((row) => (
        <View key={row.key} className="flex-row items-center gap-3">
          <Text className="w-16 font-inter-medium text-small text-ink">{row.label}</Text>
          <View className="h-2 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
            <View className={`h-full rounded-full ${row.bar}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
          </View>
          <Text className={`w-12 text-right font-inter-semibold text-small ${row.text}`}>{row.pct}%</Text>
        </View>
      ))}
    </View>
  );
}
