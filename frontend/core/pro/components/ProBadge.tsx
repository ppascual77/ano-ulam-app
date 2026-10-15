import { Text, View } from "react-native";

// The small orange PRO pill on anything that's part of Pro (Home's "Plan
// your week" card, Settings' Pro rows).
export function ProBadge() {
  return (
    <View className="rounded-full bg-accent px-2 py-0.5">
      <Text className="font-inter-extrabold text-sub text-white">PRO</Text>
    </View>
  );
}
