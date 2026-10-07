import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen, SegmentedSwitch } from "@/frontend/components/ui";
import { Header } from "@/frontend/features/home/components/Header";
import { RandomMealPuller } from "@/frontend/features/home/components/RandomMealPuller";
import { BudgetSection } from "@/frontend/core/budget/components/BudgetSection";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";

type Mode = "budget" | "pantry";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "budget", label: "By Budget" },
  { value: "pantry", label: "By Pantry" },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>("budget");

  return (
    <Screen edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* TODO: "Patrick" is a placeholder — replace with the authenticated
            user's first name once auth/profile data is wired up. */}
        <Header name="Patrick" />

        <View className="mt-6 mb-4">
          <SegmentedSwitch size="lg" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </View>
        {mode === "budget" ? <BudgetSection /> : <PantrySection />}
      </ScrollView>
      <RandomMealPuller />
    </Screen>
  );
}
