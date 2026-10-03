import { Pressable, Text, View } from "react-native";
import { Funnel } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Opens the filter sheet. Solid green with a count badge (top-left) once
// filters are applied.
export function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={active ? `Filters, ${count} applied` : "Filters"}
      className={`h-14 w-14 items-center justify-center rounded-full border ${
        active ? "border-brand-green bg-brand-green" : "border-ink-emphasis/10 bg-white active:border-brand-green"
      }`}
    >
      <Funnel color={active ? colors.white : colors.ink.subtle} size={18} />
      {active && (
        <View className="absolute -left-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
          <Text className="font-inter-bold text-sub text-brand-green">{count}</Text>
        </View>
      )}
    </Pressable>
  );
}
