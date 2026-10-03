import { View } from "react-native";
import { AppText } from "@/frontend/components/ui";

// "Step 2 of 5 · Ingredients" with one bar per step, filled up to the
// current one.
export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-1.5">
        {steps.map((step, i) => (
          <View key={step} className={`h-1 flex-1 rounded-full ${i <= current ? "bg-primary" : "bg-ink-emphasis/10"}`} />
        ))}
      </View>
      <AppText variant="caption">
        Step {current + 1} of {steps.length} · {steps[current]}
      </AppText>
    </View>
  );
}
