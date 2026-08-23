import { Pressable, Text, View } from "react-native";
import { Ban } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { DIETARY_ICONS, capitalize } from "@/core/meals/utils/dietary";

type ActivePreferencesSummaryProps = {
  dietaryFocus: string[];
  allergens: string[];
  onManage: () => void;
};

// Placeholder summary of what's set in PreferencesSheet — real values will
// come from the backend once preferences are actually persisted.
export function ActivePreferencesSummary({ dietaryFocus, allergens, onManage }: ActivePreferencesSummaryProps) {
  return (
    <View className="rounded-xl border border-ink-emphasis/10 bg-white px-5 py-4">
      <View className="flex-row items-center justify-between">
        <AppText variant="bodyBold">Active Preferences</AppText>
        <Pressable onPress={onManage}>
          <AppText variant="bodyMedium" className="text-primary">
            Manage
          </AppText>
        </Pressable>
      </View>

      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {dietaryFocus.map((id) => {
          const Icon = DIETARY_ICONS[id];
          return (
            <View key={id} className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
              {Icon && <Icon color={colors.primary} size={12} />}
              <Text className="font-inter-medium text-caption text-primary">{capitalize(id)}</Text>
            </View>
          );
        })}
        {allergens.map((id) => (
          <View key={id} className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
            <Ban color={colors.primary} size={12} />
            <Text className="font-inter-medium text-caption text-primary">No {capitalize(id)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
