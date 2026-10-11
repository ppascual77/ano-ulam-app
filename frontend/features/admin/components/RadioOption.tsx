import { Pressable, View } from "react-native";
import { AppText } from "@/frontend/components/ui";

// One choice in an admin radio group: a circle (filled when selected), a
// label and a short description. The whole card is the touch target.
export function RadioOption({
  selected,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${
        selected ? "border-primary bg-primary/5" : "border-ink-emphasis/10"
      }`}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? "border-primary" : "border-ink-emphasis/25"
        }`}
      >
        {selected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </View>
      <View className="flex-1">
        <AppText variant="bodyBold">{label}</AppText>
        <AppText variant="caption" className="text-ink-subtle">
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}
