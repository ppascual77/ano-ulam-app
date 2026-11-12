import { Pressable, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// The Add Ingredients sheet's view titles (dotted section title + a line
// under it), with a back arrow on the staples view.
export function SheetHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack?: () => void }) {
  return (
    <View className="flex-row items-center gap-3">
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.ink.emphasis} size={20} />
        </Pressable>
      )}
      <View className="flex-1">
        <AppText variant="sectionTitle" dot>
          {title}
        </AppText>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{subtitle}</Text>
      </View>
    </View>
  );
}
