import { Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { UnlockedFeature } from "./unlockedFeatures";

// One Pro feature as a plain row (not tappable): icon, what it is, and a
// check. Shared by the unlock screen and Settings' "See all Pro features".
export function ProFeatureRow({ feature, last = false }: { feature: UnlockedFeature; last?: boolean }) {
  const Icon = feature.Icon;
  return (
    <View className={`flex-row items-center gap-3 py-3.5 ${last ? "" : "border-b border-ink-emphasis/10"}`}>
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Icon color={colors.primary} size={20} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{feature.title}</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{feature.detail}</Text>
      </View>
      <Check color={colors.primary} size={18} strokeWidth={2.5} />
    </View>
  );
}
