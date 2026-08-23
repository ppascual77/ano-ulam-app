import { View } from "react-native";
import { AppText } from "@/components/ui";
import { PantryEmptyState } from "./PantryEmptyState";

// Everything Pantry mode shows on Home, as one unit.
export function PantrySection() {
  return (
    <View className="gap-3">
      <AppText variant="title">Your Pantry</AppText>
      <PantryEmptyState />
    </View>
  );
}