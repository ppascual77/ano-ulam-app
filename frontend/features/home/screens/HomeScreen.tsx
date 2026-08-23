import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ChipSelect, Screen } from "@/frontend/components/ui";
import { Header } from "@/frontend/features/home/components/Header";
import { BudgetSection } from "@/frontend/core/budget/components/BudgetSection";
import { PantrySection } from "@/frontend/core/pantry/components/PantrySection";

const MODE_OPTIONS = [
  { id: "budget", label: "By Budget" },
  { id: "pantry", label: "By Pantry" },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<string[]>(["budget"]);

  return (
    <Screen edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* TODO: "Patrick" is a placeholder — replace with the authenticated
            user's first name once auth/profile data is wired up. */}
        <Header name="Patrick" />

        <View className="mt-6 mb-4">
          <ChipSelect
            variant="segmented"
            mode="single"
            required
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
        </View>
        {mode[0] === "budget" ? <BudgetSection /> : <PantrySection />}
      </ScrollView>
    </Screen>
  );
}
